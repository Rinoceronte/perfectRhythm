import type { RequestHandler } from './$types';
import { ok } from '$lib/server/utils/api-response';
import { deleteSession } from '$lib/server/services/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');

	if (token) {
		await deleteSession(token);
	}

	cookies.delete('session', { path: '/' });

	return ok(null);
};
