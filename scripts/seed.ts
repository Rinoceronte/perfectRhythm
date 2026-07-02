import crypto from 'crypto';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
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

async function seed() {
	console.log('Seeding database...');

	const coachId = crypto.randomUUID();
	const studentId = crypto.randomUUID();
	const password = 'password123';

	const coachHash = await hashPassword(password);
	const studentHash = await hashPassword(password);

	// Create coach
	await sql`
		INSERT INTO users (id, email, display_name, role, password_hash, bio, years_dancing)
		VALUES (${coachId}, 'coach@test.com', 'Sarah Mitchell', 'coach', ${coachHash}, 'WCS coach specializing in musicality and connection', 12)
	`;
	console.log('  Created coach: coach@test.com');

	// Create student
	await sql`
		INSERT INTO users (id, email, display_name, role, password_hash, leader_level, follower_level, years_dancing)
		VALUES (${studentId}, 'student@test.com', 'Alex Rivera', 'student', ${studentHash}, 'intermediate', 'novice', 3)
	`;
	console.log('  Created student: student@test.com');

	// Link coach and student
	await sql`
		INSERT INTO coach_students (coach_id, student_id)
		VALUES (${coachId}, ${studentId})
	`;
	console.log('  Linked coach <-> student');

	// Create 3 events and link to coach
	const eventIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
	await sql`
		INSERT INTO events (id, name, location, city, state_or_region, country, start_date, end_date, is_local)
		VALUES
			(${eventIds[0]}, 'Weekly Studio Practice', 'Dance Factory Studio', 'Austin', 'TX', 'US', '2026-04-13', '2026-04-13', true),
			(${eventIds[1]}, 'Lone Star Swing', 'Austin Convention Center', 'Austin', 'TX', 'US', '2026-04-24', '2026-04-26', false),
			(${eventIds[2]}, 'Summer Swing Fest', 'Hilton Downtown', 'Houston', 'TX', 'US', '2026-05-15', '2026-05-17', false)
	`;
	await sql`
		INSERT INTO coach_events (coach_id, event_id)
		VALUES
			(${coachId}, ${eventIds[0]}),
			(${coachId}, ${eventIds[1]}),
			(${coachId}, ${eventIds[2]})
	`;
	console.log('  Created 3 events and linked to coach (no availability blocks)');

	console.log('\nDone! Login credentials:');
	console.log('  Coach:   coach@test.com   / password123');
	console.log('  Student: student@test.com / password123');

	await sql.end();
}

seed().catch((e) => {
	console.error(e);
	process.exit(1);
});
