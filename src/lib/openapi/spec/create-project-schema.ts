import type { FromSchema } from 'json-schema-to-ts';

export const createProjectSchema = {
    $id: '#/components/schemas/createProjectSchema',
    type: 'object',
    required: ['name'],
    description:
        'Data used to create a new [project](https://docs.getunleash.io/concepts/projects).',
    properties: {
        id: {
            type: 'string',
            pattern: '[A-Za-z0-9_~.-]*',
            deprecated: true,
            description:
                "The project's identifier. If this property is not present or is an empty string, Unleash will generate the project id automatically. This property is deprecated.",
            example: 'my-project',
        },
        name: {
            type: 'string',
            pattern: '^(?!\\s*$).+',
            description:
                "The project's name. The name must contain at least one non-whitespace character.",
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
            example: 'userId',
        },
        environments: {
            type: 'array',
            items: {
                type: 'string',
            },
            description:
                'A list of environments that should be enabled for this project. If this property is missing, Unleash will default to enabling all non-deprecated environments for the project. An empty list will result in no environment enabled for the project.',
            example: ['development', 'production'],
        },
        changeRequestEnvironments: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name'],
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
                'A list of environments that should have change requests enabled. If the list includes environments not in the `environments` list, they will still have change requests enabled.',
        },
    },
    components: {},
} as const;

export type CreateProjectSchema = FromSchema<typeof createProjectSchema>;
