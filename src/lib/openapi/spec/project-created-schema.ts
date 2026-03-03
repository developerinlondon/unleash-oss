import type { FromSchema } from 'json-schema-to-ts';

export const projectCreatedSchema = {
    $id: '#/components/schemas/projectCreatedSchema',
    type: 'object',
    required: ['id', 'name'],
    description: 'Details about the newly created project.',
    properties: {
        id: {
            type: 'string',
            pattern: '[A-Za-z0-9_~.-]+',
            description: "The project's identifier.",
            example: 'my-project',
        },
        name: {
            type: 'string',
            minLength: 1,
            description: "The project's name.",
            example: 'My Project',
        },
        description: {
            type: 'string',
            nullable: true,
            description: "The project's description.",
            example: 'A project for my team',
        },
        mode: {
            type: 'string',
            enum: ['open', 'protected', 'private'],
            description:
                'A mode of the project affecting what actions are possible in this project',
            example: 'open',
        },
        defaultStickiness: {
            type: 'string',
            description:
                'A default stickiness for the project affecting the default stickiness value for variants and Gradual Rollout strategy',
            example: 'default',
        },
        featureLimit: {
            type: 'number',
            nullable: true,
            description:
                'A limit on the number of features allowed in the project. `null` if no limit.',
            example: null,
        },
        environments: {
            type: 'array',
            items: {
                type: 'string',
            },
            description: 'The environments enabled for the project.',
            example: ['development', 'production'],
        },
        changeRequestEnvironments: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'requiredApprovals'],
                properties: {
                    name: {
                        type: 'string',
                        description: 'The name of the environment.',
                    },
                    requiredApprovals: {
                        type: 'integer',
                        description:
                            'The number of approvals required for a change request in this environment.',
                    },
                },
            },
            description:
                'The list of environments that have change requests enabled.',
        },
    },
    components: {},
} as const;

export type ProjectCreatedSchema = FromSchema<typeof projectCreatedSchema>;
