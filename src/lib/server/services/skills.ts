import { db } from '$lib/server/db';
import { skillCategories, skillDefinitions, studentSkills, coachStudents } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type {
	SkillCategory,
	SkillDefinitionWithCategory,
	StudentSkill,
	StudentSkillWithDetails,
	SkillSuggestion
} from '$lib/shared/types';
import type { AssignStudentSkillInput, UpdateStudentSkillInput } from '$lib/shared/validation/skills';

// ---- Priority ----

/**
 * Priority score for ranking. Lower = focus first.
 * ability + effort - benefit
 * High ability = less urgent, high effort = harder = less urgent, high benefit = more urgent.
 */
export function calculatePriority(currentScore: number, effortToImprove: number, improvementBenefit: number): number {
	const roomToGrow = 10 - currentScore;    // ability 1 → 9, ability 10 → 0
	const ease = 10 - effortToImprove;        // effort 1 → 9, effort 10 → 0
	return (roomToGrow + ease + improvementBenefit) / 3;
}

// ---- Categories ----

export async function getCategories(): Promise<SkillCategory[]> {
	const rows = await db
		.select()
		.from(skillCategories)
		.orderBy(skillCategories.name);
	return rows as SkillCategory[];
}

export async function getOrCreateCategory(name: string): Promise<SkillCategory> {
	const trimmed = name.trim();
	const existing = await db
		.select()
		.from(skillCategories)
		.where(eq(skillCategories.name, trimmed))
		.limit(1);

	if (existing.length > 0) return existing[0] as SkillCategory;

	const [row] = await db
		.insert(skillCategories)
		.values({ name: trimmed })
		.returning();

	return row as SkillCategory;
}

// ---- Definitions ----

export async function getDefinitions(categoryId?: string): Promise<SkillDefinitionWithCategory[]> {
	const query = db
		.select({
			id: skillDefinitions.id,
			name: skillDefinitions.name,
			categoryId: skillDefinitions.categoryId,
			createdAt: skillDefinitions.createdAt,
			categoryName: skillCategories.name
		})
		.from(skillDefinitions)
		.innerJoin(skillCategories, eq(skillDefinitions.categoryId, skillCategories.id));

	const rows = categoryId
		? await query.where(eq(skillDefinitions.categoryId, categoryId)).orderBy(skillDefinitions.name)
		: await query.orderBy(skillCategories.name, skillDefinitions.name);

	return rows as SkillDefinitionWithCategory[];
}

export async function getOrCreateDefinition(
	name: string,
	categoryId: string
): Promise<SkillDefinitionWithCategory> {
	const trimmed = name.trim();
	const existing = await db
		.select({
			id: skillDefinitions.id,
			name: skillDefinitions.name,
			categoryId: skillDefinitions.categoryId,
			createdAt: skillDefinitions.createdAt,
			categoryName: skillCategories.name
		})
		.from(skillDefinitions)
		.innerJoin(skillCategories, eq(skillDefinitions.categoryId, skillCategories.id))
		.where(and(eq(skillDefinitions.name, trimmed), eq(skillDefinitions.categoryId, categoryId)))
		.limit(1);

	if (existing.length > 0) return existing[0] as SkillDefinitionWithCategory;

	const [row] = await db
		.insert(skillDefinitions)
		.values({ name: trimmed, categoryId })
		.returning();

	// Fetch with category name
	const [full] = await db
		.select({
			id: skillDefinitions.id,
			name: skillDefinitions.name,
			categoryId: skillDefinitions.categoryId,
			createdAt: skillDefinitions.createdAt,
			categoryName: skillCategories.name
		})
		.from(skillDefinitions)
		.innerJoin(skillCategories, eq(skillDefinitions.categoryId, skillCategories.id))
		.where(eq(skillDefinitions.id, row.id));

	return full as SkillDefinitionWithCategory;
}

// ---- Student Skills ----

export async function getStudentSkills(coachStudentId: string): Promise<StudentSkillWithDetails[]> {
	const rows = await db
		.select({
			id: studentSkills.id,
			coachStudentId: studentSkills.coachStudentId,
			skillDefinitionId: studentSkills.skillDefinitionId,
			currentScore: studentSkills.currentScore,
			effortToImprove: studentSkills.effortToImprove,
			improvementBenefit: studentSkills.improvementBenefit,
			priorityScore: studentSkills.priorityScore,
			coachPriority: studentSkills.coachPriority,
			studentPriority: studentSkills.studentPriority,
			source: studentSkills.source,
			coachLocked: studentSkills.coachLocked,
			notes: studentSkills.notes,
			createdAt: studentSkills.createdAt,
			updatedAt: studentSkills.updatedAt,
			skillName: skillDefinitions.name,
			categoryId: skillDefinitions.categoryId,
			categoryName: skillCategories.name
		})
		.from(studentSkills)
		.innerJoin(skillDefinitions, eq(studentSkills.skillDefinitionId, skillDefinitions.id))
		.innerJoin(skillCategories, eq(skillDefinitions.categoryId, skillCategories.id))
		.where(eq(studentSkills.coachStudentId, coachStudentId))
		.orderBy(desc(studentSkills.priorityScore));

	return rows as StudentSkillWithDetails[];
}

/** Scoped lookup — verifies the coach-student relationship belongs to this coach. */
export async function getStudentSkillsForCoach(
	coachId: string,
	studentId: string
): Promise<StudentSkillWithDetails[]> {
	const rel = await db
		.select({ id: coachStudents.id })
		.from(coachStudents)
		.where(and(eq(coachStudents.coachId, coachId), eq(coachStudents.studentId, studentId)))
		.limit(1);

	if (rel.length === 0) return [];
	return getStudentSkills(rel[0].id);
}

export async function getStudentSkillById(id: string): Promise<StudentSkillWithDetails | null> {
	const rows = await db
		.select({
			id: studentSkills.id,
			coachStudentId: studentSkills.coachStudentId,
			skillDefinitionId: studentSkills.skillDefinitionId,
			currentScore: studentSkills.currentScore,
			effortToImprove: studentSkills.effortToImprove,
			improvementBenefit: studentSkills.improvementBenefit,
			priorityScore: studentSkills.priorityScore,
			coachPriority: studentSkills.coachPriority,
			studentPriority: studentSkills.studentPriority,
			source: studentSkills.source,
			coachLocked: studentSkills.coachLocked,
			notes: studentSkills.notes,
			createdAt: studentSkills.createdAt,
			updatedAt: studentSkills.updatedAt,
			skillName: skillDefinitions.name,
			categoryId: skillDefinitions.categoryId,
			categoryName: skillCategories.name
		})
		.from(studentSkills)
		.innerJoin(skillDefinitions, eq(studentSkills.skillDefinitionId, skillDefinitions.id))
		.innerJoin(skillCategories, eq(skillDefinitions.categoryId, skillCategories.id))
		.where(eq(studentSkills.id, id))
		.limit(1);

	return (rows[0] as StudentSkillWithDetails) ?? null;
}

// ---- Mutations ----

export async function assignStudentSkill(
	input: AssignStudentSkillInput,
	source: 'coach' | 'student'
): Promise<StudentSkillWithDetails> {
	const priority = calculatePriority(
		input.currentScore ?? 5,
		input.effortToImprove ?? 5,
		input.improvementBenefit ?? 5
	);

	const [row] = await db
		.insert(studentSkills)
		.values({
			coachStudentId: input.coachStudentId,
			skillDefinitionId: input.skillDefinitionId,
			currentScore: input.currentScore ?? 5,
			effortToImprove: input.effortToImprove ?? 5,
			improvementBenefit: input.improvementBenefit ?? 5,
			priorityScore: Math.round(priority),
			source,
			coachLocked: source === 'coach',
			...(input.studentPriority !== undefined && { studentPriority: input.studentPriority }),
			notes: input.notes ?? null
		})
		.returning();

	// Return with full details
	const full = await getStudentSkillById(row.id);
	return full!;
}

export async function updateStudentSkill(
	id: string,
	input: UpdateStudentSkillInput,
	source: 'coach' | 'student'
): Promise<StudentSkillWithDetails | null> {
	const existing = await getStudentSkillById(id);
	if (!existing) return null;

	// Authority check: coach > ai > student
	// If coach-locked and source is not coach, reject score changes
	if (existing.coachLocked && source !== 'coach') {
		return existing; // no changes applied
	}

	const updatedScore = input.currentScore ?? existing.currentScore;
	const updatedEffort = input.effortToImprove ?? existing.effortToImprove;
	const updatedBenefit = input.improvementBenefit ?? existing.improvementBenefit;
	const priority = calculatePriority(updatedScore, updatedEffort, updatedBenefit);

	// Coach edits always lock. Student edits never touch the lock.
	const coachLocked =
		source === 'coach'
			? (input.coachLocked ?? true) // explicit unlock allowed
			: existing.coachLocked;

	const [row] = await db
		.update(studentSkills)
		.set({
			...(input.currentScore !== undefined && { currentScore: input.currentScore }),
			...(input.effortToImprove !== undefined && { effortToImprove: input.effortToImprove }),
			...(input.improvementBenefit !== undefined && {
				improvementBenefit: input.improvementBenefit
			}),
			...(input.coachPriority !== undefined && { coachPriority: input.coachPriority }),
			...(input.studentPriority !== undefined && { studentPriority: input.studentPriority }),
			...(input.notes !== undefined && { notes: input.notes }),
			priorityScore: Math.round(priority),
			source,
			coachLocked,
			updatedAt: new Date()
		})
		.where(eq(studentSkills.id, id))
		.returning();

	if (!row) return null;
	return getStudentSkillById(row.id);
}

export async function deleteStudentSkill(id: string): Promise<boolean> {
	const result = await db
		.delete(studentSkills)
		.where(eq(studentSkills.id, id))
		.returning({ id: studentSkills.id });
	return result.length > 0;
}

// ---- AI Suggest ----

export async function applyAiSuggestions(
	coachStudentId: string,
	suggestions: SkillSuggestion[]
): Promise<void> {
	const existing = await getStudentSkills(coachStudentId);
	const lockedIds = new Set(existing.filter((s) => s.coachLocked).map((s) => s.id));

	for (const suggestion of suggestions) {
		if (lockedIds.has(suggestion.skillId)) continue;

		const priority = calculatePriority(suggestion.currentScore, suggestion.effortToImprove, suggestion.improvementBenefit);

		await db
			.update(studentSkills)
			.set({
				currentScore: suggestion.currentScore,
				effortToImprove: suggestion.effortToImprove,
				improvementBenefit: suggestion.improvementBenefit,
				priorityScore: Math.round(priority),
				source: 'ai',
				updatedAt: new Date()
			})
			.where(
				and(eq(studentSkills.id, suggestion.skillId), eq(studentSkills.coachStudentId, coachStudentId))
			);
	}
}

// ---- Relationship helpers ----

/** Verifies the coachStudentId belongs to this coach. */
export async function verifyCoachOwnsRelationship(
	coachId: string,
	coachStudentId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: coachStudents.id })
		.from(coachStudents)
		.where(and(eq(coachStudents.id, coachStudentId), eq(coachStudents.coachId, coachId)))
		.limit(1);
	return rows.length > 0;
}

/** Verifies the coachStudentId includes this student. */
export async function verifyStudentInRelationship(
	studentId: string,
	coachStudentId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: coachStudents.id })
		.from(coachStudents)
		.where(and(eq(coachStudents.id, coachStudentId), eq(coachStudents.studentId, studentId)))
		.limit(1);
	return rows.length > 0;
}
