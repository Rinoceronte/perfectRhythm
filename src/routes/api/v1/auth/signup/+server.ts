import type { RequestHandler } from './$types';
import { ok, err } from '$lib/server/utils/api-response';
import { signupSchema } from '$lib/shared/validation/auth';
import { hashPassword, createSession } from '$lib/server/services/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	if (!body) return err('INVALID_JSON', 'Invalid request body');

	const parsed = signupSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.errors[0].message);
	}

	const { email, password, displayName, role } = parsed.data;

	// Check if email already exists
	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (existing) {
		return err('EMAIL_EXISTS', 'An account with this email already exists', 409);
	}

	const passwordHash = await hashPassword(password);
	const userId = crypto.randomUUID();

	await db.insert(users).values({
		id: userId,
		email,
		displayName,
		role,
		passwordHash
	});

	const session = await createSession(userId);

	cookies.set('session', session.token, {
		path: '/',
		httpOnly: true,
		secure: false,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60
	});

	return ok({
		user: {
			id: userId,
			email,
			displayName,
			role
		}
	});
};
