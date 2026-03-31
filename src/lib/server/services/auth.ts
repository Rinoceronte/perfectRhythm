import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, sessions } from '$lib/server/db/schema';

const SESSION_DURATION_DAYS = 30;
const SESSION_EXTEND_THRESHOLD_DAYS = 1;

export interface AppUser {
	id: string;
	email: string;
	user_metadata: {
		display_name: string;
		role: string;
	};
}

export interface AppSession {
	token: string;
	expiresAt: Date;
}

// --- Password hashing (scrypt) ---

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomBytes(16).toString('hex');
	const derived = await new Promise<Buffer>((resolve, reject) => {
		crypto.scrypt(password, salt, 64, (err, key) => {
			if (err) reject(err);
			else resolve(key);
		});
	});
	return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	const [salt, key] = hash.split(':');
	const derived = await new Promise<Buffer>((resolve, reject) => {
		crypto.scrypt(password, salt, 64, (err, result) => {
			if (err) reject(err);
			else resolve(result);
		});
	});
	return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derived);
}

// --- Session management ---

export async function createSession(userId: string): Promise<AppSession> {
	const token = crypto.randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

	await db.insert(sessions).values({
		id: token,
		userId,
		expiresAt
	});

	return { token, expiresAt };
}

export async function validateSession(
	token: string
): Promise<{ session: AppSession; user: AppUser } | null> {
	const rows = await db
		.select({
			sessionId: sessions.id,
			expiresAt: sessions.expiresAt,
			userId: users.id,
			email: users.email,
			displayName: users.displayName,
			role: users.role
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
		.limit(1);

	if (rows.length === 0) return null;

	const row = rows[0];

	// Extend session if older than threshold
	const msUntilExpiry = row.expiresAt.getTime() - Date.now();
	const thresholdMs = (SESSION_DURATION_DAYS - SESSION_EXTEND_THRESHOLD_DAYS) * 24 * 60 * 60 * 1000;
	if (msUntilExpiry < thresholdMs) {
		const newExpiry = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
		await db.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, token));
		row.expiresAt = newExpiry;
	}

	return {
		session: { token: row.sessionId, expiresAt: row.expiresAt },
		user: {
			id: row.userId,
			email: row.email,
			user_metadata: {
				display_name: row.displayName,
				role: row.role
			}
		}
	};
}

export async function deleteSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, token));
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}
