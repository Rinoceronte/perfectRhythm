// White-label site settings — singleton row (id = 1) holding this deployment's branding.

import crypto from 'crypto';
import { db } from '$lib/server/db';
import { siteSettings, users } from '$lib/server/db/schema';
import { supabaseAdmin } from '$lib/server/supabase';
import { eq, asc } from 'drizzle-orm';
import type { SiteOwner, SiteSettings } from '$lib/shared/types';

const DEFAULT_SITE_NAME = 'Perfect Rhythm';

type SettingsRow = Omit<SiteSettings, 'owner'> & { ownerUserId: string | null };

// Safe as a module-level cache: adapter-node runs a single process, and the
// only writer (updateSiteSettings) invalidates it. Only the settings row is
// cached — the owner's profile is resolved fresh so profile edits show up.
let cachedRow: SettingsRow | null = null;

export async function getSiteSettings(): Promise<SiteSettings> {
	if (!cachedRow) {
		const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
		cachedRow = {
			siteName: row?.siteName ?? DEFAULT_SITE_NAME,
			tagline: row?.tagline ?? null,
			logoPath: row?.logoPath ?? null,
			logoUrl: getLogoPublicUrl(row?.logoPath ?? null),
			accentColor: row?.accentColor ?? null,
			ownerUserId: row?.ownerUserId ?? null
		};
	}

	const { ownerUserId, ...settings } = cachedRow;
	return { ...settings, owner: await resolveOwner(ownerUserId) };
}

export async function updateSiteSettings(patch: {
	siteName?: string;
	tagline?: string | null;
	logoPath?: string | null;
	accentColor?: string | null;
}): Promise<SiteSettings> {
	await db
		.insert(siteSettings)
		.values({ id: 1, ...patch, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: siteSettings.id,
			set: { ...patch, updatedAt: new Date() }
		});

	invalidateSiteSettingsCache();
	return getSiteSettings();
}

export function invalidateSiteSettingsCache() {
	cachedRow = null;
}

/**
 * The teacher this deployment belongs to. Prefers site_settings.owner_user_id;
 * falls back to the oldest coach user so unseeded dev databases still work.
 */
export async function getOwnerCoach(): Promise<SiteOwner | null> {
	const settings = await getSiteSettings();
	return settings.owner;
}

async function resolveOwner(ownerUserId: string | null): Promise<SiteOwner | null> {
	const ownerFields = {
		id: users.id,
		displayName: users.displayName,
		bio: users.bio,
		avatarUrl: users.avatarUrl
	};

	if (ownerUserId) {
		const [owner] = await db
			.select(ownerFields)
			.from(users)
			.where(eq(users.id, ownerUserId))
			.limit(1);
		if (owner) return owner;
	}

	const [fallback] = await db
		.select(ownerFields)
		.from(users)
		.where(eq(users.role, 'coach'))
		.orderBy(asc(users.createdAt))
		.limit(1);
	return fallback ?? null;
}

// ---- Logo storage (public 'branding' bucket) ----

const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg', 'webp'] as const;

export function isAllowedLogoExtension(ext: string): boolean {
	return (LOGO_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

export async function getBrandingUploadUrl(ext: string) {
	const path = `logo/${crypto.randomUUID()}.${ext.toLowerCase()}`;
	if (!supabaseAdmin) {
		console.error('getBrandingUploadUrl: supabaseAdmin is null');
		return { data: null, error: new Error('Storage not configured'), path };
	}
	const result = await supabaseAdmin.storage.from('branding').createSignedUploadUrl(path);
	if (result.error) console.error('getBrandingUploadUrl:', result.error);
	return { ...result, path };
}

function getLogoPublicUrl(logoPath: string | null): string | null {
	if (!logoPath || !supabaseAdmin) return null;
	// Pure URL construction — the 'branding' bucket is public, no signing needed
	return supabaseAdmin.storage.from('branding').getPublicUrl(logoPath).data.publicUrl;
}
