import { z } from 'zod';

export const GetUploadUrlSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(2000).nullable().optional(),
	mimeType: z.string().default('video/mp4')
});

export const ConfirmUploadSchema = z.object({
	videoId: z.string().uuid(),
	supabaseStoragePath: z.string().min(1)
});

export const CreateVideoSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(2000).nullable().optional()
});

export const SaveAnnotationsSchema = z.object({
	annotations: z.array(
		z.object({
			id: z.string(),
			timestampMs: z.number().int().min(0),
			type: z.enum(['draw', 'arrow', 'text', 'highlight']),
			data: z.record(z.string(), z.unknown()),
			durationMs: z.number().int().min(0).default(3000),
			color: z.string()
		})
	)
});

export const CreateReviewSchema = z.object({
	coachId: z.string().uuid()
});

export type GetUploadUrlInput = z.infer<typeof GetUploadUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>;
export type SaveAnnotationsInput = z.infer<typeof SaveAnnotationsSchema>;
