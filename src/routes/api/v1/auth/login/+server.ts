import type { RequestHandler } from './$types';
import { ok, err } from '$lib/server/utils/api-response';
import { loginSchema } from '$lib/shared/validation/auth';
import { verifyPassword, createSession } from '$lib/server/services/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	if (!body) return err('INVALID_JSON', 'Invalid request body');

	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.errors[0].message);
	}

	const { email, password } = parsed.data;

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (!user || !user.passwordHash) {
		return err('INVALID_CREDENTIALS', 'Invalid email or password', 401);
	}

	const valid = await verifyPassword(password, user.passwordHash);
	if (!valid) {
		return err('INVALID_CREDENTIALS', 'Invalid email or password', 401);
	}

	const session = await createSession(user.id);

	cookies.set('session', session.token, {
		path: '/',
		httpOnly: true,
		secure: false,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60
	});

	return ok({
		user: {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
			role: user.role
		}
	});
};
