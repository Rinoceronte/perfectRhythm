import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	users,
	coachStudents,
	studentSkills,
	skillDefinitions,
	skillCategories
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/login');

	const role = (user.user_metadata?.role as 'student' | 'coach') ?? 'student';
	if (role !== 'coach') redirect(303, '/');

	// Get the coach-student relationship
	const relationship = await db
		.select({
			coachStudentId: coachStudents.id,
			status: coachStudents.status,
			createdAt: coachStudents.createdAt,
			studentId: users.id,
			displayName: users.displayName,
			email: users.email,
			avatarUrl: users.avatarUrl,
			bio: users.bio,
			leaderLevel: users.leaderLevel,
			followerLevel: users.followerLevel,
			yearsDancing: users.yearsDancing
		})
		.from(coachStudents)
		.innerJoin(users, eq(coachStudents.studentId, users.id))
		.where(and(eq(coachStudents.coachId, user.id), eq(coachStudents.studentId, params.id)))
		.limit(1);

	if (relationship.length === 0) error(404, 'Student not found');

	const student = relationship[0];

	// Get skills grouped by category
	const skills = await db
		.select({
			id: studentSkills.id,
			currentScore: studentSkills.currentScore,
			effortToImprove: studentSkills.effortToImprove,
			improvementBenefit: studentSkills.improvementBenefit,
			priorityScore: studentSkills.priorityScore,
			coachLocked: studentSkills.coachLocked,
			source: studentSkills.source,
			skillName: skillDefinitions.name,
			categoryName: skillCategories.name,
			categoryId: skillCategories.id
		})
		.from(studentSkills)
		.innerJoin(skillDefinitions, eq(studentSkills.skillDefinitionId, skillDefinitions.id))
		.innerJoin(skillCategories, eq(skillDefinitions.categoryId, skillCategories.id))
		.where(eq(studentSkills.coachStudentId, student.coachStudentId))
		.orderBy(skillCategories.name, skillDefinitions.name);

	// Group by category
	const categoryMap = new Map<
		string,
		{
			name: string;
			skills: typeof skills;
		}
	>();

	for (const skill of skills) {
		const existing = categoryMap.get(skill.categoryName);
		if (existing) {
			existing.skills.push(skill);
		} else {
			categoryMap.set(skill.categoryName, { name: skill.categoryName, skills: [skill] });
		}
	}

	const categories = [...categoryMap.values()].map((cat) => {
		const avgScore =
			cat.skills.length > 0
				? Math.round(
						(cat.skills.reduce((sum, s) => sum + s.currentScore, 0) / cat.skills.length) * 10
					) / 10
				: 0;
		return {
			name: cat.name,
			avgScore,
			skillCount: cat.skills.length,
			skills: cat.skills.map((s) => ({
				id: s.id,
				name: s.skillName,
				currentScore: s.currentScore,
				effortToImprove: s.effortToImprove,
				improvementBenefit: s.improvementBenefit,
				priorityScore: s.priorityScore,
				coachLocked: s.coachLocked,
				source: s.source
			}))
		};
	});

	return {
		student: {
			id: student.studentId,
			displayName: student.displayName,
			email: student.email,
			avatarUrl: student.avatarUrl,
			bio: student.bio,
			leaderLevel: student.leaderLevel,
			followerLevel: student.followerLevel,
			yearsDancing: student.yearsDancing,
			since: student.createdAt!.toISOString(),
			coachStudentId: student.coachStudentId
		},
		categories
	};
};
