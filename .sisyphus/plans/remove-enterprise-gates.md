# Remove Enterprise Gates from Unleash OSS

## TL;DR

> **Quick Summary**: Remove Enterprise-only gates from Unleash OSS to enable project creation, environment management, and multi-project support. Build custom Docker image and deploy via ArgoCD.
>
> **Deliverables**:
> - Project CRUD API (POST/PUT/DELETE `/api/admin/projects`)
> - Environment CRUD API (POST/PUT/DELETE/clone `/api/admin/environments`)
> - Frontend UI for project creation and environment management
> - GitHub Actions CI/CD pipeline → `ghcr.io/developerinlondon/unleash-oss`
> - GitOps Helm values update for ArgoCD deployment
>
> **Estimated Effort**: Medium (~1 day)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 (foundation gates) → Task 2/3 (CRUD) → Task 5 (tests) → Task 6 (CI/CD)

---

## Context

### Original Request

Remove Enterprise-only restrictions from Unleash OSS so we can create custom projects and environments (dev/qa/prod) for the Simons Golden Image Factory. Build a custom Docker image for deployment via ArgoCD.

### Interview Summary

**Key Discussions**:
- Unleash OSS v7.3.0 uses hook-based architecture — Enterprise injects routes via `preRouterHook`
- Apache 2.0 license — fully permissible to fork/modify
- GitLab feature flags evaluated as alternative — rejected due to per-project scoping limitations
- Repo: `github.com/developerinlondon/unleash-oss`, branch `feat/remove-enterprise-gates`

**Research Findings**:
- 10 gating locations identified (not 6 as originally thought)
- RBAC middleware actively blocks non-default projects/environments — CRITICAL gate missed in initial analysis
- Project controller hardcodes `{ id: 'default' }` query — second CRITICAL gate
- Environment service missing CRUD methods entirely; store layer has them
- Project service already has `createProject()`, `updateProject()`, `deleteProject()`
- Typed audit event classes needed for environment CRUD (don't exist)

### Metis Review

**Identified Gaps** (addressed):
- RBAC middleware gate at `rbac-middleware.ts:102-118` — added to Phase 1
- Project controller `{ id: 'default' }` hardcode — added to Phase 1
- Typed event classes for environment CRUD — added to Phase 1
- Frontend has 8 `enterprise: true` routes, not 2 — clarified scope: only ungate project + environment routes
- `create-config.test.ts` and `feature-environment-store.test.ts` need updates — added to Phase 5

---

## Work Objectives

### Core Objective

Enable full project and environment CRUD in Unleash OSS by removing Enterprise gates, adding missing service/route code, and deploying via a custom Docker image.

### Concrete Deliverables

- `POST /api/admin/projects` returns 201 (project created)
- `POST /api/admin/environments` returns 201 (environment created)
- `PUT/DELETE` for both resources work
- Frontend shows "Create project" and "Environments" pages
- Docker image at `ghcr.io/developerinlondon/unleash-oss:latest`
- All existing tests pass (with intentional updates to OSS-specific tests)

### Definition of Done

- [ ] `curl -X POST /api/admin/projects -d '{"id":"test","name":"Test"}'` → 201
- [ ] `curl -X POST /api/admin/environments -d '{"name":"qa","type":"production"}'` → 201
- [ ] `curl GET /api/admin/projects` returns > 1 project
- [ ] `curl GET /api/admin/environments` returns > 2 environments
- [ ] `yarn lint && yarn build:backend && yarn test` all pass
- [ ] `docker build -t unleash-oss:test .` succeeds
- [ ] GitHub Actions builds and pushes to GHCR on merge to main

### Must Have

- Project creation, update, delete via API
- Environment creation, update, delete, clone via API
- Frontend pages for project creation and environment management
- Docker image build + push pipeline
- Audit events emitted for all CRUD operations

### Must NOT Have (Guardrails)

- Do NOT ungate Change Requests, Insights, Impact Metrics, Release Plans, or other Enterprise features whose backend services don't exist in OSS
- Do NOT remove the `isOss` configuration option from `IUnleashConfig` — only stop using it for store/middleware filtering
- Do NOT touch Enterprise-only services (SSO, SCIM, Signals, Service Accounts)
- Do NOT modify the `preRouterHook` mechanism — it must still work for Enterprise
- Do NOT create new database migrations — all needed tables already exist
- Do NOT change the existing Dockerfile — it already works

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL verification is executed by the agent using tools. No human action required.

### Test Decision

- **Infrastructure exists**: YES (Vitest + Supertest)
- **Automated tests**: YES (Tests-after — update existing + add new)
- **Framework**: Vitest (`yarn test`)
- **Lint**: Biome (`yarn lint`)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| Backend API | Bash (curl) | Send requests, assert status codes + response bodies |
| Frontend UI | Playwright | Navigate, check pages exist, create project/env |
| Docker build | Bash | `docker build`, `docker run`, health check |
| CI/CD | Bash (gh) | Verify workflow file, check Actions status |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Remove all foundation gates (isOss, RBAC, hardcodes)
├── Task 7: Fix .gitignore (remove .claude exclusion)
└── (independent, can run in parallel)

Wave 2 (After Wave 1):
├── Task 2: Environment CRUD (service + routes) [depends: 1]
├── Task 3: Project CRUD routes [depends: 1]
└── Task 4: Frontend route ungating [depends: 1]

Wave 3 (After Wave 2):
├── Task 5: Update tests [depends: 2, 3]
├── Task 6: GitHub Actions CI/CD [depends: 2, 3]
└── Task 8: GitOps Helm values update [depends: 6]
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 4, 5 | 7 |
| 2 | 1 | 5, 8 | 3, 4 |
| 3 | 1 | 5, 8 | 2, 4 |
| 4 | 1 | None | 2, 3 |
| 5 | 2, 3 | None | 6 |
| 6 | 2, 3 | 8 | 5 |
| 7 | None | None | 1 |
| 8 | 6 | None | 5 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 7 | task(category="deep", load_skills=[]) — foundation changes need careful analysis |
| 2 | 2, 3, 4 | dispatch parallel — 2 and 3 are "unspecified-high", 4 is "quick" |
| 3 | 5, 6, 8 | 5 is "unspecified-high", 6 and 8 are "quick" |

---

## TODOs

- [ ] 1. Remove All Foundation Gates (isOss, RBAC, Project Hardcode, Event Classes)

  **What to do**:
  - Remove `isOss` filter blocks from environment-store.ts (4 locations: lines 171-176, 197-199, 227-229, 279-285)
  - Remove `isOss` filter from project-store.ts (line 139-141: `if (this.isOss) { projects = projects.where('id', 'default'); }`)
  - Remove or neuter `addOssFilterIfNeeded()` in feature-environment-store.ts (lines 106-128)
  - Remove `if (config.isOss)` block from rbac-middleware.ts (lines 102-118) — this blocks ALL non-default projects and non-standard environments at the permission layer
  - Remove `{ id: 'default' }` hardcode from project-controller.ts line 227 — change to `{}` or remove the filter
  - Remove `removePropertiesForNonEnterprise()` method from project-service.ts (line 1359-1365) and all its call sites
  - Remove `if (this.isEnterprise)` guard on `changeRequestEnvironments` in project-service.ts (line 414)
  - Create typed event classes in `src/lib/types/events.ts`: `EnvironmentCreatedEvent`, `EnvironmentUpdatedEvent`, `EnvironmentDeletedEvent`, `EnvironmentClonedEvent` — follow `ProjectCreatedEvent` pattern at line 289-301

  **Must NOT do**:
  - Do NOT remove the `isOss` property from `IUnleashConfig` type — other code may read it
  - Do NOT remove `isOss` from constructor parameters — just don't use it for filtering
  - Do NOT modify `preRouterHook` mechanism in app.ts
  - Do NOT touch any Enterprise-only feature code

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Foundation changes across many files, needs careful cross-reference analysis to avoid breaking other consumers of `isOss`
  - **Skills**: []
    - No special skills needed — pure TypeScript backend changes
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser testing needed for backend gate removal
    - `frontend-ui-ux`: No UI work in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 7)
  - **Blocks**: Tasks 2, 3, 4, 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/lib/types/events.ts:289-301` — `ProjectCreatedEvent` class pattern to follow for environment event classes
  - `src/lib/types/events.ts:1736` — `SegmentCreatedEvent` with data payload pattern
  - `src/lib/features/feature-toggle/feature-toggle-service.ts` — Event emission pattern in service methods

  **API/Type References**:
  - `src/lib/types/option.ts:180,306-307` — `isOss` and `isEnterprise` type definitions in `IUnleashConfig`
  - `src/lib/create-config.ts:518-527` — `resolveIsOss()` function showing how the flag is set

  **Gate Locations (EXHAUSTIVE)**:
  - `src/lib/features/project-environments/environment-store.ts:171-176` — `get()` isOss filter
  - `src/lib/features/project-environments/environment-store.ts:197-199` — `getAll()` isOss filter
  - `src/lib/features/project-environments/environment-store.ts:227-229` — `getAllWithCounts()` isOss filter
  - `src/lib/features/project-environments/environment-store.ts:279-285` — `getProjectEnvironments()` isOss filter
  - `src/lib/features/project/project-store.ts:139-141` — `getAll()` isOss filter
  - `src/lib/db/feature-environment-store.ts:106-128` — `addOssFilterIfNeeded()` helper
  - `src/lib/routes/admin-api/rbac-middleware.ts:102-118` — RBAC permission block for non-default projects/envs (CRITICAL)
  - `src/lib/features/project/project-controller.ts:227` — Hardcoded `{ id: 'default' }` query (CRITICAL)
  - `src/lib/features/project/project-service.ts:1359-1365` — `removePropertiesForNonEnterprise()` method
  - `src/lib/features/project/project-service.ts:414` — `if (this.isEnterprise)` guard

  **Verification Tool**: Use `ast_grep_search` pattern `this.isOss` and `lsp_find_references` on `isOss` in `option.ts:307` to confirm ALL consumers are found before claiming completion.

  **Acceptance Criteria**:

  - [ ] All 10 gate locations addressed (removed or neutered)
  - [ ] `isOss` property still exists in `IUnleashConfig` (not removed from type)
  - [ ] 4 typed event classes created in events.ts
  - [ ] `yarn build:backend` passes (no TypeScript errors)
  - [ ] `yarn lint` passes (no biome errors)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: TypeScript compilation succeeds after gate removal
    Tool: Bash
    Preconditions: Node 22+ installed, dependencies installed (yarn install)
    Steps:
      1. Run: yarn build:backend 2>&1
      2. Assert: Exit code 0
      3. Assert: stdout does not contain "error TS"
    Expected Result: Clean TypeScript compilation
    Evidence: Build output captured

  Scenario: Linting passes after gate removal
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run: yarn lint 2>&1
      2. Assert: Exit code 0
    Expected Result: No lint errors
    Evidence: Lint output captured

  Scenario: Verify no remaining isOss store filters
    Tool: Bash (ast-grep or grep)
    Preconditions: Gate removal complete
    Steps:
      1. Run: grep -rn "this.isOss" src/lib/features/project-environments/environment-store.ts
      2. Assert: No matches (constructor assignment is OK but filtering blocks must be gone)
      3. Run: grep -rn "this.isOss" src/lib/features/project/project-store.ts
      4. Assert: No filtering blocks remain
      5. Run: grep -rn "addOssFilterIfNeeded" src/lib/db/feature-environment-store.ts
      6. Assert: Method is removed or is a no-op
    Expected Result: All store-level isOss filtering removed
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `feat: remove isOss gates and add environment event classes`
  - Files: `src/lib/features/project-environments/environment-store.ts`, `src/lib/features/project/project-store.ts`, `src/lib/db/feature-environment-store.ts`, `src/lib/routes/admin-api/rbac-middleware.ts`, `src/lib/features/project/project-controller.ts`, `src/lib/features/project/project-service.ts`, `src/lib/types/events.ts`
  - Pre-commit: `yarn build:backend && yarn lint`

---

- [ ] 2. Add Environment CRUD (Service Methods + Controller Routes)

  **What to do**:
  - Add 5 methods to `src/lib/features/project-environments/environment-service.ts`:
    - `create(env: IEnvironmentCreate, auditUser: IAuditUser)` — call `this.environmentStore.create(env)`, emit `EnvironmentCreatedEvent`
    - `update(name: string, env: Partial<IEnvironment>, auditUser: IAuditUser)` — call `this.environmentStore.update()`, emit `EnvironmentUpdatedEvent`
    - `delete(name: string, auditUser: IAuditUser)` — call `this.environmentStore.delete()`, emit `EnvironmentDeletedEvent`
    - `clone(name: string, newName: string, type: string, auditUser: IAuditUser)` — get existing env, create copy with new name, emit event
    - `validateEnvironmentName(name: string)` — use `exists()` check, throw if already exists
  - Add 5 routes to `src/lib/features/environments/environments-controller.ts`:
    - `POST /` → `createEnvironment` (permission: ADMIN)
    - `PUT /update/:name` → `updateEnvironment` (permission: ADMIN)
    - `DELETE /:name` → `deleteEnvironment` (permission: ADMIN)
    - `POST /:name/clone` → `cloneEnvironment` (permission: ADMIN)
    - `POST /validate` → `validateEnvironmentName` (permission: ADMIN)
  - Add OpenAPI request/response schemas for new endpoints in `src/lib/openapi/spec/`
  - Ensure route paths EXACTLY match what `frontend/src/hooks/api/actions/useEnvironmentApi/useEnvironmentApi.ts` expects

  **Must NOT do**:
  - Do NOT create database migrations — tables already exist
  - Do NOT add Change Request integration to environment CRUD
  - Do NOT add any enterprise-only middleware

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Significant new code (service methods + routes + OpenAPI schemas) following existing patterns
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: Backend-only task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Tasks 5, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/lib/features/environments/environments-controller.ts` — Existing controller to extend (follow route registration pattern at lines 52-70)
  - `src/lib/features/project-environments/environment-service.ts` — Existing service to extend (follow `toggleEnvironment()` at line 122 for event emission pattern)
  - `src/lib/features/feature-toggle/feature-toggle-controller.ts` — Full CRUD controller pattern reference
  - `src/lib/features/segment/segment-controller.ts` — Another CRUD controller pattern reference

  **API/Type References**:
  - `frontend/src/hooks/api/actions/useEnvironmentApi/useEnvironmentApi.ts` — Frontend expects EXACTLY these endpoints (lines 26-74)
  - `src/lib/openapi/spec/environment-schema.ts` — Existing environment response schema
  - `src/lib/openapi/spec/environments-schema.ts` — Existing environments list schema
  - `src/lib/types/model.ts` — `IEnvironment`, `IEnvironmentCreate` type definitions
  - `src/lib/features/project-environments/environment-store-type.ts` — Store interface with `create()`, `update()`, `delete()` methods

  **Test References**:
  - `src/lib/features/environments/environment-oss.e2e.test.ts` — OSS environment e2e tests (will need updating in Task 5)

  **Acceptance Criteria**:

  - [ ] All 5 service methods implemented with event emission
  - [ ] All 5 routes registered with OpenAPI specs
  - [ ] Route paths match frontend expectations exactly
  - [ ] `yarn build:backend` passes
  - [ ] `yarn lint` passes

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Create environment returns 201
    Tool: Bash (curl)
    Preconditions: Dev server running on localhost:4242 (yarn dev:backend), admin API token configured
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:4242/api/admin/environments \
           -H "Authorization: *:*.admin-token" \
           -H "Content-Type: application/json" \
           -d '{"name":"staging","type":"production"}'
      2. Assert: HTTP status is 201 or 200
      3. Assert: response contains "name":"staging"
      4. GET /api/admin/environments → Assert "staging" appears in list
    Expected Result: Environment created and visible
    Evidence: Response bodies captured

  Scenario: Delete environment succeeds
    Tool: Bash (curl)
    Preconditions: "staging" environment exists from previous scenario
    Steps:
      1. curl -s -w "\n%{http_code}" -X DELETE http://localhost:4242/api/admin/environments/staging \
           -H "Authorization: *:*.admin-token"
      2. Assert: HTTP status is 200 or 204
      3. GET /api/admin/environments → Assert "staging" no longer in list
    Expected Result: Environment deleted
    Evidence: Response bodies captured

  Scenario: Validate environment name rejects duplicates
    Tool: Bash (curl)
    Preconditions: "development" environment exists (default)
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:4242/api/admin/environments/validate \
           -H "Authorization: *:*.admin-token" \
           -H "Content-Type: application/json" \
           -d '{"name":"development"}'
      2. Assert: HTTP status is 409 or 400
    Expected Result: Duplicate name rejected
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat: add environment CRUD service methods and routes`
  - Files: `src/lib/features/project-environments/environment-service.ts`, `src/lib/features/environments/environments-controller.ts`, `src/lib/openapi/spec/*.ts`
  - Pre-commit: `yarn build:backend && yarn lint`

---

- [ ] 3. Add Project CRUD Routes

  **What to do**:
  - Add 3 route handlers to `src/lib/features/project/project-controller.ts`:
    - `POST /` → `createProject` (permission: ADMIN) — call `this.projectService.createProject()`
    - `PUT /:projectId` → `updateProject` (permission: ADMIN) — call `this.projectService.updateProject()`
    - `DELETE /:projectId` → `deleteProject` (permission: ADMIN) — call `this.projectService.deleteProject()`
  - Add OpenAPI request/response schemas for new endpoints
  - Ensure route paths match what `frontend/src/hooks/api/actions/useProjectApi/useProjectApi.ts` expects

  **Must NOT do**:
  - Do NOT modify the existing service methods — they already work
  - Do NOT add Change Request integration
  - Do NOT add project archiving (archive endpoint is a separate concern)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New route handlers + OpenAPI schemas, following existing patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4)
  - **Blocks**: Tasks 5, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/lib/features/project/project-controller.ts` — Existing controller to extend
  - `src/lib/features/feature-toggle/feature-toggle-controller.ts` — Full CRUD controller reference
  - `src/lib/features/segment/segment-controller.ts` — Another CRUD pattern

  **API/Type References**:
  - `frontend/src/hooks/api/actions/useProjectApi/useProjectApi.ts` — Frontend endpoint expectations
  - `src/lib/features/project/project-service.ts:367` — `createProject()` method (already exists)
  - `src/lib/openapi/spec/project-overview-schema.ts` — Existing project schemas
  - `src/lib/openapi/spec/projects-schema.ts` — Projects list schema

  **Acceptance Criteria**:

  - [ ] All 3 routes registered with OpenAPI specs
  - [ ] `yarn build:backend` passes
  - [ ] `yarn lint` passes

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Create project returns 201
    Tool: Bash (curl)
    Preconditions: Dev server running on localhost:4242
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:4242/api/admin/projects \
           -H "Authorization: *:*.admin-token" \
           -H "Content-Type: application/json" \
           -d '{"id":"simons","name":"Simons"}'
      2. Assert: HTTP status is 201 or 200
      3. Assert: response contains "id":"simons"
    Expected Result: Project created
    Evidence: Response body captured

  Scenario: List projects returns multiple projects
    Tool: Bash (curl)
    Preconditions: "simons" project created from previous scenario
    Steps:
      1. curl -s http://localhost:4242/api/admin/projects \
           -H "Authorization: *:*.admin-token" | jq '.projects | length'
      2. Assert: Output is > 1 (default + simons)
    Expected Result: Multiple projects visible
    Evidence: Response body captured

  Scenario: Delete project succeeds
    Tool: Bash (curl)
    Preconditions: "simons" project exists
    Steps:
      1. curl -s -w "\n%{http_code}" -X DELETE http://localhost:4242/api/admin/projects/simons \
           -H "Authorization: *:*.admin-token"
      2. Assert: HTTP status is 200 or 204
    Expected Result: Project deleted
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat: add project CRUD routes`
  - Files: `src/lib/features/project/project-controller.ts`, `src/lib/openapi/spec/*.ts`
  - Pre-commit: `yarn build:backend && yarn lint`

---

- [ ] 4. Remove Frontend Enterprise Route Gates

  **What to do**:
  - In `frontend/src/component/menu/routes.ts`:
    - Remove `enterprise: true` from `/projects/create` route (line 84)
    - Remove `enterprise: true` from `/environments` route (line 300)
    - Remove `enterprise: true` from `/projects-archive` route (line 133) — nice to have
  - Verify that `frontend/src/component/common/util.ts` `filterByConfig()` function (line 30-33) correctly hides/shows routes after property removal

  **Must NOT do**:
  - Do NOT remove `enterprise: true` from `/change-requests` (line 152) — backend services don't exist
  - Do NOT remove `enterprise: true` from `/insights` (line 172) — backend services don't exist
  - Do NOT remove `enterprise: true` from `/impact-metrics` (line 182) — backend services don't exist
  - Do NOT remove `enterprise: true` from `/release-templates/*` (lines 326, 335) — backend services don't exist

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple property removal from 2-3 route definitions
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:

  - `frontend/src/component/menu/routes.ts:84` — `/projects/create` with `enterprise: true`
  - `frontend/src/component/menu/routes.ts:300` — `/environments` with `enterprise: true`
  - `frontend/src/component/menu/routes.ts:133` — `/projects-archive` with `enterprise: true`
  - `frontend/src/component/common/util.ts:30-33` — `filterByConfig()` gating logic

  **Acceptance Criteria**:

  - [ ] `enterprise: true` removed from 3 routes
  - [ ] `yarn --cwd frontend build` passes (frontend builds without errors)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Frontend build succeeds after route changes
    Tool: Bash
    Preconditions: Frontend dependencies installed
    Steps:
      1. Run: yarn --cwd frontend build 2>&1
      2. Assert: Exit code 0
    Expected Result: Clean frontend build
    Evidence: Build output captured
  ```

  **Commit**: YES
  - Message: `feat: ungate project and environment frontend routes`
  - Files: `frontend/src/component/menu/routes.ts`
  - Pre-commit: `yarn --cwd frontend build`

---

- [ ] 5. Update Tests

  **What to do**:
  - Update `src/lib/features/environments/environment-oss.e2e.test.ts` — currently asserts OSS filtering behavior; update to reflect that custom environments are now visible
  - Update `src/lib/features/project/project-service.test.ts` — unit tests with `isEnterprise` mocking may need adjustments
  - Update `src/lib/features/project/project-service.e2e.test.ts` — project service e2e tests
  - Update or remove `isOss`-specific assertions in `src/lib/create-config.test.ts` (6 tests for `resolveIsOss`)
  - Update `src/lib/db/feature-environment-store.test.ts` — initializes with `isOss: true`
  - Add new e2e tests for environment CRUD endpoints (create, update, delete, clone, validate)
  - Add new e2e tests for project CRUD endpoints (create, update, delete)
  - Run full test suite and fix any failures

  **Must NOT do**:
  - Do NOT delete test files — update them
  - Do NOT skip or `.skip()` existing tests — fix them properly
  - Do NOT remove `resolveIsOss` tests in create-config.test.ts — update expected values

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple test files to update + new e2e tests to write, needs understanding of codebase testing patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 6)
  - **Blocks**: None
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Test References**:
  - `src/lib/features/environments/environment-oss.e2e.test.ts` — Existing OSS environment tests (MUST update)
  - `src/lib/features/project/project-service.test.ts` — Unit tests with isEnterprise mocking
  - `src/lib/features/project/project-service.e2e.test.ts` — Project service e2e tests
  - `src/lib/create-config.test.ts` — Tests for `resolveIsOss` function
  - `src/lib/db/feature-environment-store.test.ts` — Feature environment store tests

  **Pattern References**:
  - `src/test/fixtures/fake-feature-toggle-store.ts` — Fake store pattern for testing
  - `src/lib/features/feature-toggle/tests/` — E2E test patterns for CRUD endpoints

  **Acceptance Criteria**:

  - [ ] `yarn test` passes — all tests green
  - [ ] New e2e tests cover: create env, delete env, clone env, create project, delete project
  - [ ] No `.skip()` on previously-working tests

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Full test suite passes
    Tool: Bash
    Preconditions: Dependencies installed, test database available
    Steps:
      1. Run: yarn test 2>&1 | tail -30
      2. Assert: Exit code 0
      3. Assert: Output contains "Tests passed" or similar success indicator
      4. Assert: Output does NOT contain "FAIL" for unexpected test files
    Expected Result: All tests pass
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `test: update OSS tests and add CRUD endpoint e2e tests`
  - Files: `src/lib/features/environments/environment-oss.e2e.test.ts`, `src/lib/features/project/*.test.ts`, `src/lib/create-config.test.ts`, `src/lib/db/feature-environment-store.test.ts`, plus new test files
  - Pre-commit: `yarn test`

---

- [ ] 6. Create GitHub Actions CI/CD Workflow

  **What to do**:
  - Create `.github/workflows/release.yml`:
    - Trigger: push to `main` branch AND tag push matching `v*`
    - Steps: checkout → set up Node 22 → login to GHCR → build Docker image → push to GHCR
    - Image: `ghcr.io/developerinlondon/unleash-oss`
    - Tags: `latest` (on main push), semver tag (on `v*` tag), git SHA short
  - Use existing `Dockerfile` (do NOT modify it)
  - Ensure GHCR login uses `GITHUB_TOKEN` (auto-provided by Actions)

  **Must NOT do**:
  - Do NOT modify the existing Dockerfile
  - Do NOT add unnecessary build steps (the Dockerfile handles everything)
  - Do NOT push to Docker Hub or ECR — only GHCR

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard GitHub Actions Docker build workflow — well-known pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 2, 3 (need code changes before building image)

  **References**:

  **External References**:
  - GitHub Actions: `docker/build-push-action@v5` — standard Docker build action
  - GitHub Actions: `docker/login-action@v3` — GHCR login
  - GitHub Actions: `docker/metadata-action@v5` — automated tag generation

  **Pattern References**:
  - `~/code/assay/.github/workflows/release.yml` — Reference release workflow from assay repo (similar pattern: build + push to GHCR)

  **Acceptance Criteria**:

  - [ ] `.github/workflows/release.yml` file exists and is valid YAML
  - [ ] Workflow triggers on push to main and on `v*` tags
  - [ ] Uses `ghcr.io/developerinlondon/unleash-oss` as image name
  - [ ] Uses `GITHUB_TOKEN` for GHCR auth

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Workflow YAML is valid
    Tool: Bash
    Steps:
      1. python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
      2. Assert: Exit code 0 (valid YAML)
      3. grep "ghcr.io/developerinlondon/unleash-oss" .github/workflows/release.yml
      4. Assert: Image name found
    Expected Result: Valid workflow file
    Evidence: Validation output captured
  ```

  **Commit**: YES
  - Message: `ci: add GitHub Actions release workflow for Docker image`
  - Files: `.github/workflows/release.yml`

---

- [ ] 7. Fix .gitignore — Remove .claude Exclusion

  **What to do**:
  - Edit `.gitignore` at repo root:
    - Remove line 7: `.claude`
  - Verify `.sisyphus` is NOT in `.gitignore` (it shouldn't be — it's not there now)

  **Must NOT do**:
  - Do NOT add any other entries to .gitignore
  - Do NOT modify any other lines

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line removal from .gitignore
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `.gitignore:7` — Line containing `.claude`

  **Acceptance Criteria**:
  - [ ] `.claude` no longer in `.gitignore`
  - [ ] `.sisyphus` not in `.gitignore`
  - [ ] `git add .claude/ .sisyphus/` works without `-f`

  **Commit**: YES (group with Task 1)
  - Message: `chore: remove .claude from gitignore`
  - Files: `.gitignore`

---

- [ ] 8. Update GitOps Helm Values (Separate Repo — Separate MR)

  **What to do**:
  - In `~/code/gitops` repo, create a new branch
  - Edit `apps/shared-infra/unleash/helm/base/values.yaml`:
    - Add image override to point to our custom GHCR image:
      ```yaml
      unleash:
        image:
          repository: ghcr.io/developerinlondon/unleash-oss
          tag: "latest"
      ```
  - Create MR to `dev` branch

  **Must NOT do**:
  - Do NOT push directly to `dev` or `main` (gitops repo constraint)
  - Do NOT modify any other Helm values
  - Do NOT include AI attribution in commit message

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single values.yaml edit + MR creation
  - **Skills**: [`git-master`]
    - `git-master`: Branch creation, commit, MR via `gh`/`glab`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Wave 3)
  - **Blocks**: None
  - **Blocked By**: Task 6 (need CI/CD pipeline to have built the image first)

  **References**:
  - `~/code/gitops/apps/shared-infra/unleash/helm/base/values.yaml` — Current Helm values (no image override)
  - `~/code/gitops/apps/shared-infra/unleash/Chart.yaml` — Wrapper chart using `unleash/unleash` v5.6.4
  - `~/code/gitops/AGENTS.md` — Git author: `nayeem syed <nayeem.syed.ext@siemens.com>`, never push directly to dev/main

  **Acceptance Criteria**:
  - [ ] `values.yaml` contains `image.repository: ghcr.io/developerinlondon/unleash-oss`
  - [ ] MR created targeting `dev` branch
  - [ ] Git author is `nayeem syed <nayeem.syed.ext@siemens.com>`

  **Commit**: YES
  - Message: `feat(unleash): switch to custom unleash-oss image`
  - Files: `apps/shared-infra/unleash/helm/base/values.yaml`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `feat: remove isOss gates and add environment event classes` | stores, middleware, events.ts | `yarn build:backend && yarn lint` |
| 7 | `chore: remove .claude from gitignore` | .gitignore | `git add .claude/` works |
| 2 | `feat: add environment CRUD service methods and routes` | environment-service, controller | `yarn build:backend && yarn lint` |
| 3 | `feat: add project CRUD routes` | project-controller | `yarn build:backend && yarn lint` |
| 4 | `feat: ungate project and environment frontend routes` | routes.ts | `yarn --cwd frontend build` |
| 5 | `test: update OSS tests and add CRUD endpoint e2e tests` | *.test.ts | `yarn test` |
| 6 | `ci: add GitHub Actions release workflow for Docker image` | release.yml | YAML validation |
| 8 | `feat(unleash): switch to custom unleash-oss image` | values.yaml (gitops repo) | MR created |

---

## Success Criteria

### Verification Commands

```bash
# Backend compiles
yarn build:backend  # Expected: exit 0, no TS errors

# Lint passes
yarn lint  # Expected: exit 0

# All tests pass
yarn test  # Expected: exit 0

# Docker build succeeds
docker build -t unleash-oss:test .  # Expected: exit 0

# Environment CRUD works
curl -X POST localhost:4242/api/admin/environments -H "Authorization: *:*.token" -H "Content-Type: application/json" -d '{"name":"qa","type":"production"}'  # Expected: 201

# Project CRUD works
curl -X POST localhost:4242/api/admin/projects -H "Authorization: *:*.token" -H "Content-Type: application/json" -d '{"id":"simons","name":"Simons"}'  # Expected: 201

# Multi-project listing works
curl localhost:4242/api/admin/projects -H "Authorization: *:*.token" | jq '.projects | length'  # Expected: > 1
```

### Final Checklist

- [ ] All "Must Have" features present
- [ ] All "Must NOT Have" guardrails respected
- [ ] All tests pass
- [ ] Docker image builds
- [ ] GitHub Actions workflow exists
- [ ] GitOps MR created
