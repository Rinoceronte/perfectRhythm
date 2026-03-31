import { z } from 'zod';

export const competitionLevelSchema = z.enum([
	'newcomer',
	'novice',
	'intermediate',
	'advanced',
	'allstar',
	'champion'
]);

export const updateProfileSchema = z.object({
	bio: z.string().max(500).nullable().optional(),
	leaderLevel: competitionLevelSchema.nullable().optional(),
	followerLevel: competitionLevelSchema.nullable().optional(),
	yearsDancing: z.number().int().min(0).max(99).nullable().optional()
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
