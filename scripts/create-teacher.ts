// One-time per-deployment setup: creates (or updates) the teacher account and
// the site_settings singleton row that brands this instance.
//
// Usage:
//   TEACHER_EMAIL=sarah@example.com TEACHER_PASSWORD=... TEACHER_NAME="Sarah Mitchell" \
//   SITE_NAME="Sarah's Swing Studio" SITE_TAGLINE="West coast swing in Austin" \
//   pnpm teacher:create

import crypto from 'crypto';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const DATABASE_URL =
	process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = postgres(DATABASE_URL);

// Same scrypt hashing as auth service
async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomBytes(16).toString('hex');
	const derived = await new Promise<Buffer>((resolve, reject) => {
		crypto.scrypt(password, salt, 64, (err, key) => {
			if (err) reject(err);
			else resolve(key);
		});
	});
	return `${salt}:${derived.toString('hex')}`;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`Missing required env var: ${name}`);
		process.exit(1);
	}
	return value;
}

async function ensureBrandingBucket() {
	const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_KEY;
	if (!supabaseUrl || !serviceKey) {
		console.log('  Supabase credentials not set — skipping branding bucket setup');
		return;
	}
	const supabase = createClient(supabaseUrl, serviceKey);
	const { error } = await supabase.storage.createBucket('branding', { public: true });
	if (error && !/already exists/i.test(error.message)) {
		console.warn(`  Could not create 'branding' bucket: ${error.message}`);
	} else {
		console.log("  Ensured public 'branding' storage bucket");
	}
}

async function createTeacher() {
	const email = requireEnv('TEACHER_EMAIL');
	const password = requireEnv('TEACHER_PASSWORD');
	const name = requireEnv('TEACHER_NAME');
	const siteName = requireEnv('SITE_NAME');
	const tagline = process.env.SITE_TAGLINE || null;

	console.log('Setting up teacher deployment...');

	const passwordHash = await hashPassword(password);

	// Upsert teacher by email
	const [teacher] = await sql`
		INSERT INTO users (id, email, display_name, role, password_hash)
		VALUES (${crypto.randomUUID()}, ${email}, ${name}, 'coach', ${passwordHash})
		ON CONFLICT (email) DO UPDATE
		SET display_name = ${name}, role = 'coach', password_hash = ${passwordHash}, updated_at = now()
		RETURNING id
	`;
	console.log(`  Teacher account ready: ${email}`);

	// Upsert the site_settings singleton
	await sql`
		INSERT INTO site_settings (id, site_name, tagline, owner_user_id)
		VALUES (1, ${siteName}, ${tagline}, ${teacher.id})
		ON CONFLICT (id) DO UPDATE
		SET site_name = ${siteName}, tagline = ${tagline}, owner_user_id = ${teacher.id}, updated_at = now()
	`;
	console.log(`  Site branded as: ${siteName}`);

	await ensureBrandingBucket();

	console.log('\nDone! The teacher can log in and finish branding at /settings.');
	await sql.end();
}

createTeacher().catch((e) => {
	console.error(e);
	process.exit(1);
});
