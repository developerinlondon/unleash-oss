import type { FromSchema } from 'json-schema-to-ts';

export const updateProjectSchema = {
    $id: '#/components/schemas/updateProjectSchema',
    type: 'object',
    required: ['name'],
    description:
        'Data used to update a [project](https://docs.getunleash.io/concepts/projects)',
    properties: {
        name: {
            type: 'string',
            pattern: '^(?!\\s*$).+',
            description:
                'The new name of the project. The name must contain at least one non-whitespace character.',
            example: 'My Project',
        },
        description: {
            type: 'string',
            description: 'A new description for the project',
            example: 'A longer description',
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
    },
    components: {},
} as const;

export type UpdateProjectSchema = FromSchema<typeof updateProjectSchema>;
