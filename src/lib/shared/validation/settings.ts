import { z } from 'zod';

export const updateSiteSettingsSchema = z.object({
	siteName: z.string().min(1, 'Site name is required').max(100).optional(),
	tagline: z.string().max(200).nullable().optional(),
	accentColor: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, 'Accent color must be a hex color like #1a2b3c')
		.nullable()
		.optional(),
	logoPath: z.string().max(500).nullable().optional()
});

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;
