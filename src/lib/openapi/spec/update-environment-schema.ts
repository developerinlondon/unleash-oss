import type { FromSchema } from 'json-schema-to-ts';

export const updateEnvironmentSchema = {
    $id: '#/components/schemas/updateEnvironmentSchema',
    type: 'object',
    additionalProperties: false,
    required: ['sortOrder', 'type'],
    description: 'The payload for updating an environment.',
    properties: {
        sortOrder: {
            type: 'integer',
            example: 1,
            description: 'The sort order of the environment.',
        },
        type: {
            type: 'string',
            example: 'production',
            description: 'The type of the environment.',
        },
    },
    components: {},
} as const;

export type UpdateEnvironmentSchema = FromSchema<
    typeof updateEnvironmentSchema
>;
