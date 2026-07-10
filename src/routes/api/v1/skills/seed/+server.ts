import type { RequestHandler } from '@sveltejs/kit';
import { err } from '$lib/server/utils/api-response';

// Seed endpoint removed — skills are now coach-created from a global pool

export const POST: RequestHandler = async () => {
	return err(
		'DEPRECATED',
		'The seed endpoint has been removed. Skills are now created from a global definition pool.',
		410
	);
};
