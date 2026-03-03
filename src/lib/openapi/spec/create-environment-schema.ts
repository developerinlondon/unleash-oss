import type { FromSchema } from 'json-schema-to-ts';

export const createEnvironmentSchema = {
    $id: '#/components/schemas/createEnvironmentSchema',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'type'],
    description: 'The payload for creating a new environment.',
    properties: {
        name: {
            type: 'string',
            example: 'staging',
            description: 'The name of the environment.',
        },
        type: {
            type: 'string',
            example: 'pre-production',
            description: 'The type of the environment.',
        },
    },
    components: {},
} as const;

export type CreateEnvironmentSchema = FromSchema<
    typeof createEnvironmentSchema
>;
