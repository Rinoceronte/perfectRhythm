import type { ApiResponse } from '$lib/shared/types';
import type { UpdateProfileInput } from '$lib/shared/validation/profile';

export interface ProfileData {
	id: string;
	bio: string | null;
	leaderLevel: string | null;
	followerLevel: string | null;
	yearsDancing: number | null;
}

export async function updateProfile(input: UpdateProfileInput): Promise<ApiResponse<ProfileData>> {
	const res = await fetch('/api/v1/profile', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}
