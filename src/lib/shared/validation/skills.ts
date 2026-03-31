import { z } from 'zod';

export const CreateSkillCategorySchema = z.object({
	name: z.string().min(1).max(100)
});

export const CreateSkillDefinitionSchema = z.object({
	name: z.string().min(1).max(100),
	categoryId: z.string().uuid()
});

export const AssignStudentSkillSchema = z.object({
	coachStudentId: z.string().uuid(),
	skillDefinitionId: z.string().uuid(),
	currentScore: z.number().int().min(1).max(10).optional(),
	effortToImprove: z.number().int().min(1).max(10).optional(),
	improvementBenefit: z.number().int().min(1).max(10).optional(),
	studentPriority: z.number().int().min(1).max(10).nullable().optional(),
	notes: z.string().max(500).optional()
});

export const UpdateStudentSkillSchema = z.object({
	currentScore: z.number().int().min(1).max(10).optional(),
	effortToImprove: z.number().int().min(1).max(10).optional(),
	improvementBenefit: z.number().int().min(1).max(10).optional(),
	coachLocked: z.boolean().optional(),
	coachPriority: z.number().int().min(1).nullable().optional(),
	studentPriority: z.number().int().min(1).nullable().optional(),
	notes: z.string().max(500).optional()
});

export const AiSuggestSchema = z.object({
	coachStudentId: z.string().uuid(),
	videoReviewTranscript: z.string().optional()
});

export const ReorderSkillsSchema = z.object({
	coachStudentId: z.string().uuid(),
	orderedIds: z.array(z.string().uuid())
});

export type CreateSkillCategoryInput = z.infer<typeof CreateSkillCategorySchema>;
export type CreateSkillDefinitionInput = z.infer<typeof CreateSkillDefinitionSchema>;
export type AssignStudentSkillInput = z.infer<typeof AssignStudentSkillSchema>;
export type UpdateStudentSkillInput = z.infer<typeof UpdateStudentSkillSchema>;
export type AiSuggestInput = z.infer<typeof AiSuggestSchema>;
export type ReorderSkillsInput = z.infer<typeof ReorderSkillsSchema>;
