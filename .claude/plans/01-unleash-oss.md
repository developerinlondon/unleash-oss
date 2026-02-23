# Plan: Unleash OSS — Remove Enterprise Gates

## Background

We self-host Unleash v7.3.0 (via Helm chart `unleash/unleash` v5.6.4) on the `dev-ss` cluster in the `infra` namespace. The current deployment uses the upstream Docker image `unleashorg/unleash-server`.

Unleash OSS gates project creation and environment management behind Enterprise licensing. The relevant API endpoints return 404 because the routes are never registered in the OSS codebase — they are injected at runtime by a separate `unleash-enterprise` package via `preRouterHook`.

We need these features for our Simons Golden Image Factory to manage feature flags across dev/qa/prod environments and multiple projects.

**License**: Apache 2.0 — forking and modifying is fully permitted.

**Repo**: `github.com/developerinlondon/unleash-oss` (cloned from `github.com/Unleash/unleash` main branch)
**Local path**: `~/code/unleash-oss`
**Upstream**: `git remote upstream` points to `github.com/Unleash/unleash`

---

## Problem Statement

Two critical API endpoints return 404 on Unleash OSS:

1. **`POST /api/admin/projects`** — cannot create projects (stuck with `default`)
2. **`POST /api/admin/environments`** — cannot create environments (stuck with `development` + `production`)

We need both to configure Unleash with custom projects and a `qa` environment.

---

## Architecture Context

### How Enterprise Gating Works

Unleash uses a **hook-based architecture** — Enterprise does NOT fork OSS. Instead:

1. OSS starts up via `src/lib/server-impl.ts`
2. `preRouterHook` (in `src/lib/app.ts` line 188-190) is called before routes bind
3. Enterprise injects 50+ additional controllers/services/stores via this hook
4. OSS never registers the CRUD routes for projects/environments

### Two Gating Layers

| Layer | Mechanism | Impact |
|-------|-----------|--------|
| **Route layer** | POST/PUT/DELETE routes for project + environment CRUD are completely absent from OSS controllers | API returns 404 |
| **Store layer** | `isOss` flag hardcodes environment allowlist to `['default', 'development', 'production']` | Even if routes existed, custom environments would be invisible |

### Edition Detection

**Backend** (`src/lib/create-config.ts`):
- `isEnterprise = Boolean(options.enterpriseVersion) && ui.environment !== 'pro'`
- `isOss = !isEnterprise && uiEnvironment !== 'pro'`
- Without `enterpriseVersion` option, `isOss = true`

**Frontend** (`frontend/src/hooks/api/getters/useUiConfig/useUiConfig.ts`):
- `isOss()` = `!data?.versionInfo?.current?.enterprise`
- `isEnterprise()` = environment !== 'pro' AND enterprise version exists

---

## Scope of Changes

### Phase 1: Backend — Environment CRUD (Priority: HIGH)

**Goal**: Enable creating, updating, deleting, and cloning environments via the admin API.

#### 1.1 Remove `isOss` Store Filtering

**Files to modify:**

| File | Lines | Change |
|------|-------|--------|
| `src/lib/features/project-environments/environment-store.ts` | 171-176 | Remove `isOss` filter in `get()` |
| `src/lib/features/project-environments/environment-store.ts` | 197-199 | Remove `isOss` filter in `getAll()` |
| `src/lib/features/project-environments/environment-store.ts` | 227-229 | Remove `isOss` filter in `getAllWithCounts()` |
| `src/lib/features/project-environments/environment-store.ts` | 279-285 | Remove `isOss` filter in `getProjectEnvironments()` |
| `src/lib/features/project/project-store.ts` | 139-141 | Remove `isOss` filter in `getAll()` (only shows `default` project) |
| `src/lib/db/feature-environment-store.ts` | 106-128 | Remove `isOss` filter in `addOssFilterIfNeeded()` |

**What these filters do**: When `isOss=true`, all environment queries are restricted to only return `['default', 'development', 'production']`, and project queries only return `default`. Removing them allows custom environments and projects to be visible.

#### 1.2 Add Environment Service Methods

**File**: `src/lib/features/project-environments/environment-service.ts`

The service currently only has: `getAll`, `get`, `getProjectEnvironments`, `exists`, `updateSortOrder`, `toggleEnvironment`, `addEnvironmentToProject`, `removeEnvironmentFromProject`, `updateDefaultStrategy`, `overrideEnabledProjects`.

**Methods to add** (follow existing patterns in the codebase — see `src/lib/features/feature-toggle/feature-toggle-service.ts` for event emission patterns):

| Method | Description | Notes |
|--------|-------------|-------|
| `create(env: IEnvironmentCreate, auditUser: IAuditUser)` | Create new environment | Store's `create()` already exists and works |
| `update(name: string, env: Partial<IEnvironment>, auditUser: IAuditUser)` | Update environment | Store's `update()` already exists |
| `delete(name: string, auditUser: IAuditUser)` | Delete environment | Store's `delete()` already exists |
| `clone(name: string, newName: string, type: string, auditUser: IAuditUser)` | Clone environment | Get existing + create copy |
| `validateEnvironmentName(name: string)` | Validate env name is unique | Use `exists()` check |

Each method should emit appropriate events (e.g., `ENVIRONMENT_CREATED`, `ENVIRONMENT_DELETED`). Check `src/lib/types/events.ts` for event type constants.

#### 1.3 Add Environment CRUD Routes

**File**: `src/lib/features/environments/environments-controller.ts`

Currently only registers: GET `/`, GET `/:name`, GET `/project/:projectId`, PUT `/sort-order`, POST `/:name/on`, POST `/:name/off`.

**Routes to add:**

| Method | Path | Handler | Permission | OpenAPI operationId |
|--------|------|---------|------------|-------------------|
| POST | `/` | `createEnvironment` | ADMIN | `createEnvironment` |
| PUT | `/update/:name` | `updateEnvironment` | ADMIN | `updateEnvironment` |
| DELETE | `/:name` | `deleteEnvironment` | ADMIN | `deleteEnvironment` |
| POST | `/:name/clone` | `cloneEnvironment` | ADMIN | `cloneEnvironment` |
| POST | `/validate` | `validateEnvironmentName` | ADMIN | `validateEnvironmentName` |

**Reference**: The frontend already calls these exact endpoints in `frontend/src/hooks/api/actions/useEnvironmentApi/useEnvironmentApi.ts`.

**OpenAPI schemas**: Check `src/lib/openapi/spec/` for existing environment schemas. You'll need request schemas for create/update/clone.

### Phase 2: Backend — Project CRUD (Priority: HIGH)

**Goal**: Enable creating, updating, deleting, and archiving projects via the admin API.

#### 2.1 Add Project CRUD Routes

**File**: `src/lib/features/project/project-controller.ts`

Currently only registers GET routes. The `ProjectService.createProject()` method already exists at line 367 and is fully functional.

**Routes to add:**

| Method | Path | Handler | Permission | OpenAPI operationId |
|--------|------|---------|------------|-------------------|
| POST | `/` | `createProject` | ADMIN | `createProject` |
| PUT | `/:projectId` | `updateProject` | ADMIN | `updateProject` |
| DELETE | `/:projectId` | `deleteProject` | ADMIN | `deleteProject` |

**Reference**: The frontend calls these in `frontend/src/hooks/api/actions/useProjectApi/useProjectApi.ts`.

**Service methods that already exist** (in `project-service.ts`):
- `createProject()` (line 367)
- `updateProject()` 
- `deleteProject()`

These are already implemented — they just need route handlers to call them.

#### 2.2 Remove Enterprise-Only Property Stripping

**File**: `src/lib/features/project/project-service.ts`

- Line 1360: `removePropertiesForNonEnterprise()` strips `mode` and `changeRequestEnvironments` from project data in OSS
- Line 414: `if (this.isEnterprise)` check gates `changeRequestEnvironments` processing
- **Change**: Remove the `removePropertiesForNonEnterprise()` method and let all properties through. Remove the `isEnterprise` guard on `changeRequestEnvironments` (or make it a no-op if the data isn't present).

### Phase 3: Frontend — Remove Enterprise Route Gates (Priority: MEDIUM)

**File**: `frontend/src/component/menu/routes.ts`

Remove `enterprise: true` from routes we need:

| Line | Path | Current | Change |
|------|------|---------|--------|
| 84 | `/projects/create` | `enterprise: true` | Remove line |
| 300 | `/environments` | `enterprise: true` | Remove line |

**Optional** (not needed for our use case, but nice to have):
| Line | Path | Description |
|------|------|-------------|
| 133 | `/projects-archive` | Archived projects list |

Do NOT touch these — we don't need them:
- Line 152: `/change-requests`
- Line 172: `/insights`
- Line 182: `/impact-metrics`
- Lines 326, 335: `/release-templates/*`

### Phase 4: Docker Image & GitHub Actions (Priority: HIGH)

**Goal**: Build and publish our custom Unleash image to GHCR for ArgoCD consumption.

#### 4.1 GitHub Actions Workflow

**File to create**: `.github/workflows/release.yml`

Workflow should:
1. Trigger on push to `main` branch (and optionally on tags for versioned releases)
2. Build the Docker image using the existing `Dockerfile`
3. Push to `ghcr.io/developerinlondon/unleash-oss:<tag>`
4. Tag with: `latest`, git SHA, and semver tag if applicable

**Image naming**: `ghcr.io/developerinlondon/unleash-oss`
**Base**: Use existing `Dockerfile` (Node 22 Alpine, multi-stage build)

#### 4.2 GitOps Helm Values Update

**File**: `~/code/gitops/apps/shared-infra/unleash/helm/base/values.yaml`

Add image override to switch from upstream `unleashorg/unleash-server` to our custom build:

```yaml
unleash:
  image:
    repository: ghcr.io/developerinlondon/unleash-oss
    tag: "latest"  # or specific version tag
```

### Phase 5: Testing & Verification (Priority: HIGH)

#### 5.1 Backend Tests

- Run existing test suite: `yarn test` (vitest)
- Key test files to verify:
  - `src/lib/features/environments/environment-oss.e2e.test.ts` — currently asserts OSS filtering. **Must be updated** to reflect new behavior.
  - `src/lib/features/project/project-service.e2e.test.ts` — project service tests
  - `src/lib/features/project/project-service.test.ts` — unit tests with `isEnterprise` mocking
- Write new e2e tests for the added CRUD endpoints

#### 5.2 Lint & Type Check

```bash
yarn lint          # biome check
yarn build:backend # tsc compile
yarn test          # vitest
```

#### 5.3 Local Docker Verification

```bash
docker compose up -d
# Then test against http://localhost:4242:
curl -X POST http://localhost:4242/api/admin/environments \
  -H "Authorization: *:*.your-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"qa","type":"production"}'

curl -X POST http://localhost:4242/api/admin/projects \
  -H "Authorization: *:*.your-token" \
  -H "Content-Type: application/json" \
  -d '{"id":"simons","name":"Simons"}'
```

#### 5.4 PostSync Job Verification

After deploying the new image:
1. The existing PostSync job (`postsync-configure-job.yaml` in gitops) should succeed
2. Verify: `kubectl --context dev-ss get jobs -n infra -l app=unleash-configure`
3. Verify API: `curl -s https://unleash.admin.dev.simons.disw.siemens.com/api/admin/projects` should show the new project

---

## File Inventory

### Files to MODIFY (unleash-oss repo)

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/features/project-environments/environment-store.ts` | Remove 4 `isOss` filter blocks |
| 2 | `src/lib/features/project/project-store.ts` | Remove 1 `isOss` filter block |
| 3 | `src/lib/db/feature-environment-store.ts` | Remove `addOssFilterIfNeeded()` or make it a no-op |
| 4 | `src/lib/features/project-environments/environment-service.ts` | Add create/update/delete/clone/validate methods |
| 5 | `src/lib/features/environments/environments-controller.ts` | Add POST/PUT/DELETE route handlers |
| 6 | `src/lib/features/project/project-controller.ts` | Add POST/PUT/DELETE route handlers |
| 7 | `src/lib/features/project/project-service.ts` | Remove `isEnterprise` guards and `removePropertiesForNonEnterprise()` |
| 8 | `frontend/src/component/menu/routes.ts` | Remove `enterprise: true` from 2 routes |
| 9 | `src/lib/features/environments/environment-oss.e2e.test.ts` | Update test expectations |

### Files to CREATE (unleash-oss repo)

| # | File | Purpose |
|---|------|---------|
| 1 | `.github/workflows/release.yml` | Build + push Docker image to GHCR |

### Files to MODIFY (gitops repo — separate MR)

| # | File | Change |
|---|------|--------|
| 1 | `apps/shared-infra/unleash/helm/base/values.yaml` | Add image override to `ghcr.io/developerinlondon/unleash-oss` |
| 2 | `apps/shared-infra/unleash/templates/postsync-configure-job.yaml` | Update if needed after API changes |

---

## Effort Estimate

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1: Environment CRUD | ~4 hours | Low — store methods exist, just need service + routes |
| Phase 2: Project CRUD | ~2 hours | Low — service methods already exist, just need routes |
| Phase 3: Frontend gates | ~15 minutes | None |
| Phase 4: Docker + CI | ~1 hour | Low — Dockerfile already exists |
| Phase 5: Testing | ~2 hours | Medium — existing tests may need updates |
| **Total** | **~1 day** | **Low overall** |

---

## Out of Scope

These Enterprise features are NOT needed and should NOT be modified:

- Change Requests (`/change-requests`)
- SSO/SAML/OIDC authentication
- Service Accounts
- Signals & Actions
- Insights/Analytics (`/insights`)
- SCIM provisioning
- Private Projects
- Release Plans/Templates
- Impact Metrics
- Login History
- Custom Roles
- Banners

---

## Dependencies

- **Node.js 22** (matches Dockerfile)
- **Yarn** (workspaces, corepack)
- **PostgreSQL 15** (for local testing via docker-compose)
- **GitHub Actions** (for CI/CD)
- **GHCR** (for Docker image hosting)

---

## Upstream Sync Strategy

Our changes are **additive** (adding routes/methods, removing filters). To sync with upstream Unleash releases:

```bash
git fetch upstream
git merge upstream/main
```

Merge conflicts should be rare because:
- We're adding new route handlers (new code, not modifying existing)
- We're removing `isOss` checks (small deletions)
- Enterprise features remain untouched
- Frontend change is a single property removal

**Recommended cadence**: Sync with upstream on each Unleash minor release.
