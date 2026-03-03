import type { Request, Response } from 'express';
import Controller from '../../routes/controller.js';
import type { IUnleashServices } from '../../services/index.js';
import type { IUnleashConfig } from '../../types/option.js';
import type EnvironmentService from '../project-environments/environment-service.js';
import { ADMIN, NONE } from '../../types/permissions.js';
import type { OpenApiService } from '../../services/openapi-service.js';
import { createRequestSchema } from '../../openapi/util/create-request-schema.js';
import {
    createResponseSchema,
    resourceCreatedResponseSchema,
} from '../../openapi/util/create-response-schema.js';
import {
    environmentsSchema,
    type EnvironmentsSchema,
} from '../../openapi/spec/environments-schema.js';
import {
    environmentSchema,
    type EnvironmentSchema,
} from '../../openapi/spec/environment-schema.js';
import type { SortOrderSchema } from '../../openapi/spec/sort-order-schema.js';
import {
    emptyResponse,
    getStandardResponses,
} from '../../openapi/util/standard-responses.js';
import {
    environmentsProjectSchema,
    type EnvironmentsProjectSchema,
} from '../../openapi/spec/environments-project-schema.js';
import type { CreateEnvironmentSchema } from '../../openapi/spec/create-environment-schema.js';
import type { UpdateEnvironmentSchema } from '../../openapi/spec/update-environment-schema.js';
import type { CloneEnvironmentSchema } from '../../openapi/spec/clone-environment-schema.js';
import type { IAuthRequest } from '../../routes/unleash-types.js';
import { extractAuditInfo } from '../../util/extract-user.js';

interface EnvironmentParam {
    name: string;
}

interface ProjectParam {
    projectId: string;
}

export class EnvironmentsController extends Controller {
    private openApiService: OpenApiService;

    private service: EnvironmentService;

    constructor(
        config: IUnleashConfig,
        {
            environmentService,
            openApiService,
        }: Pick<IUnleashServices, 'environmentService' | 'openApiService'>,
    ) {
        super(config);
        this.openApiService = openApiService;
        this.service = environmentService;

        this.route({
            method: 'get',
            path: '',
            handler: this.getAllEnvironments,
            permission: NONE,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Get all environments',
                    description:
                        'Retrieves all environments that exist in this Unleash instance.',
                    operationId: 'getAllEnvironments',
                    responses: {
                        200: createResponseSchema('environmentsSchema'),
                        ...getStandardResponses(401, 403),
                    },
                }),
            ],
        });

        this.route({
            method: 'get',
            path: '/:name',
            handler: this.getEnvironment,
            permission: NONE,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    operationId: 'getEnvironment',
                    summary: 'Get the environment with `name`',
                    description:
                        'Retrieves the environment with `name` if it exists in this Unleash instance',
                    responses: {
                        200: createResponseSchema('environmentSchema'),
                        ...getStandardResponses(401, 403, 404),
                    },
                }),
            ],
        });

        this.route({
            method: 'get',
            path: '/project/:projectId',
            handler: this.getProjectEnvironments,
            permission: NONE,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    operationId: 'getProjectEnvironments',
                    summary: 'Get the environments available to a project',
                    description:
                        'Gets the environments that are available for this project. An environment is available for a project if enabled in the [project configuration](https://docs.getunleash.io/concepts/environments#enable-an-environment)',
                    responses: {
                        200: createResponseSchema('environmentsProjectSchema'),
                        ...getStandardResponses(401, 403, 404),
                    },
                }),
            ],
        });

        this.route({
            method: 'put',
            path: '/sort-order',
            handler: this.updateSortOrder,
            permission: ADMIN,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Update environment sort orders',
                    description:
                        'Updates sort orders for the named environments. Environments not specified are unaffected.',
                    operationId: 'updateSortOrder',
                    requestBody: createRequestSchema('sortOrderSchema'),
                    responses: {
                        200: emptyResponse,
                        ...getStandardResponses(401, 403, 404),
                    },
                }),
            ],
        });

        this.route({
            method: 'post',
            path: '/:name/on',
            acceptAnyContentType: true,
            handler: this.toggleEnvironmentOn,
            permission: ADMIN,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Toggle the environment with `name` on',
                    description:
                        'Makes it possible to enable this environment for a project. An environment must first be globally enabled using this endpoint before it can be enabled for a project',
                    operationId: 'toggleEnvironmentOn',
                    responses: {
                        204: emptyResponse,
                        ...getStandardResponses(401, 403, 404),
                    },
                }),
            ],
        });

        this.route({
            method: 'post',
            path: '/:name/off',
            acceptAnyContentType: true,
            handler: this.toggleEnvironmentOff,
            permission: ADMIN,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Toggle the environment with `name` off',
                    description:
                        'Removes this environment from the list of available environments for projects to use',
                    operationId: 'toggleEnvironmentOff',
                    responses: {
                        204: emptyResponse,
                        ...getStandardResponses(401, 403, 404),
                    },
                }),
            ],
        });

        this.route({
            method: 'post',
            path: '/validate',
            handler: this.validateEnvironmentName,
            permission: ADMIN,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Validate an environment name',
                    description:
                        'Validates whether the provided environment name can be used. Returns 200 if the name is valid, 409 if it already exists.',
                    operationId: 'validateEnvironmentName',
                    requestBody: createRequestSchema('nameSchema'),
                    responses: {
                        200: emptyResponse,
                        ...getStandardResponses(401, 403, 409),
                    },
                }),
            ],
        });

        this.route({
            method: 'post',
            path: '',
            handler: this.createEnvironment,
            permission: ADMIN,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Create a new environment',
                    description:
                        'Creates a new environment with the specified name and type.',
                    operationId: 'createEnvironment',
                    requestBody: createRequestSchema('createEnvironmentSchema'),
                    responses: {
                        201: resourceCreatedResponseSchema('environmentSchema'),
                        ...getStandardResponses(401, 403, 409),
                    },
                }),
            ],
        });

        this.route({
            method: 'put',
            path: '/update/:name',
            handler: this.updateEnvironment,
            permission: ADMIN,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Update an environment',
                    description:
                        'Updates the type and sort order of the specified environment.',
                    operationId: 'updateEnvironment',
                    requestBody: createRequestSchema('updateEnvironmentSchema'),
                    responses: {
                        200: createResponseSchema('environmentSchema'),
                        ...getStandardResponses(401, 403, 404),
                    },
                }),
            ],
        });

        this.route({
            method: 'delete',
            path: '/:name',
            handler: this.deleteEnvironment,
            permission: ADMIN,
            acceptAnyContentType: true,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Delete an environment',
                    description:
                        'Deletes the environment with the specified name.',
                    operationId: 'deleteEnvironment',
                    responses: {
                        200: emptyResponse,
                        ...getStandardResponses(401, 403, 404),
                    },
                }),
            ],
        });

        this.route({
            method: 'post',
            path: '/:name/clone',
            handler: this.cloneEnvironment,
            permission: ADMIN,
            middleware: [
                openApiService.validPath({
                    tags: ['Environments'],
                    summary: 'Clone an environment',
                    description:
                        'Creates a copy of the specified environment with a new name.',
                    operationId: 'cloneEnvironment',
                    requestBody: createRequestSchema('cloneEnvironmentSchema'),
                    responses: {
                        201: resourceCreatedResponseSchema('environmentSchema'),
                        ...getStandardResponses(401, 403, 404, 409),
                    },
                }),
            ],
        });
    }

    async getAllEnvironments(
        _req: Request,
        res: Response<EnvironmentsSchema>,
    ): Promise<void> {
        this.openApiService.respondWithValidation(
            200,
            res,
            environmentsSchema.$id,
            { version: 1, environments: await this.service.getAll() },
        );
    }

    async updateSortOrder(
        req: Request<unknown, unknown, SortOrderSchema>,
        res: Response,
    ): Promise<void> {
        await this.service.updateSortOrder(req.body);
        res.status(200).end();
    }

    async toggleEnvironmentOn(
        req: Request<EnvironmentParam>,
        res: Response,
    ): Promise<void> {
        const { name } = req.params;
        await this.service.toggleEnvironment(name, true);
        res.status(204).end();
    }

    async toggleEnvironmentOff(
        req: Request<EnvironmentParam>,
        res: Response,
    ): Promise<void> {
        const { name } = req.params;
        await this.service.toggleEnvironment(name, false);
        res.status(204).end();
    }

    async getEnvironment(
        req: Request<EnvironmentParam>,
        res: Response<EnvironmentSchema>,
    ): Promise<void> {
        this.openApiService.respondWithValidation(
            200,
            res,
            environmentSchema.$id,
            await this.service.get(req.params.name),
        );
    }

    async getProjectEnvironments(
        req: Request<ProjectParam>,
        res: Response<EnvironmentsProjectSchema>,
    ): Promise<void> {
        const environments = await this.service.getProjectEnvironments(
            req.params.projectId,
        );
        this.openApiService.respondWithValidation(
            200,
            res,
            environmentsProjectSchema.$id,
            {
                version: 1,
                environments,
            },
        );
    }

    async createEnvironment(
        req: IAuthRequest<unknown, unknown, CreateEnvironmentSchema>,
        res: Response<EnvironmentSchema>,
    ): Promise<void> {
        const environment = await this.service.create(
            req.body,
            extractAuditInfo(req),
        );
        this.openApiService.respondWithValidation(
            201,
            res,
            environmentSchema.$id,
            environment,
            { location: `environments/${environment.name}` },
        );
    }

    async updateEnvironment(
        req: IAuthRequest<EnvironmentParam, unknown, UpdateEnvironmentSchema>,
        res: Response<EnvironmentSchema>,
    ): Promise<void> {
        const { name } = req.params;
        const { type, sortOrder } = req.body;
        const environment = await this.service.update(
            name,
            {
                type,
                protected: false,
                requiredApprovals: null,
            },
            extractAuditInfo(req),
        );
        if (sortOrder !== undefined) {
            await this.service.updateSortOrder({
                [name]: sortOrder,
            });
        }
        this.openApiService.respondWithValidation(
            200,
            res,
            environmentSchema.$id,
            environment,
        );
    }

    async deleteEnvironment(
        req: IAuthRequest<EnvironmentParam>,
        res: Response,
    ): Promise<void> {
        const { name } = req.params;
        await this.service.delete(name, extractAuditInfo(req));
        res.status(200).end();
    }

    async cloneEnvironment(
        req: IAuthRequest<EnvironmentParam, unknown, CloneEnvironmentSchema>,
        res: Response<EnvironmentSchema>,
    ): Promise<void> {
        const { name } = req.params;
        const { name: newName, type } = req.body;
        const environment = await this.service.clone(
            name,
            newName,
            type,
            extractAuditInfo(req),
        );
        this.openApiService.respondWithValidation(
            201,
            res,
            environmentSchema.$id,
            environment,
            { location: `environments/${environment.name}` },
        );
    }

    async validateEnvironmentName(
        req: IAuthRequest<unknown, unknown, { name: string }>,
        res: Response,
    ): Promise<void> {
        const { name } = req.body;
        await this.service.validateEnvironmentName(name);
        res.status(200).end();
    }
}
