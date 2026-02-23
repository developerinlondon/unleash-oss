import type { FromSchema } from 'json-schema-to-ts';

export const cloneEnvironmentSchema = {
    $id: '#/components/schemas/cloneEnvironmentSchema',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'type'],
    description: 'The payload for cloning an environment.',
    properties: {
        name: {
            type: 'string',
            example: 'staging-copy',
            description: 'The name of the new cloned environment.',
        },
        type: {
            type: 'string',
            example: 'pre-production',
            description: 'The type of the new cloned environment.',
        },
        projects: {
            type: 'array',
            items: {
                type: 'string',
            },
            example: ['default'],
            description: 'A list of project ids to clone the environment for.',
        },
        clonePermissions: {
            type: 'boolean',
            example: true,
            description:
                'Whether to clone the permissions from the source environment.',
        },
    },
    components: {},
} as const;

export type CloneEnvironmentSchema = FromSchema<typeof cloneEnvironmentSchema>;
