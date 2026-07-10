import type { ApiResponse, SiteSettings } from '$lib/shared/types';
import type { UpdateSiteSettingsInput } from '$lib/shared/validation/settings';

export async function updateSiteSettings(
	input: UpdateSiteSettingsInput
): Promise<ApiResponse<SiteSettings>> {
	const res = await fetch('/api/v1/settings', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function getLogoUploadUrl(
	ext: string
): Promise<ApiResponse<{ uploadUrl: string; storagePath: string }>> {
	const res = await fetch('/api/v1/settings/logo-upload-url', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ext })
	});
	return res.json();
}
