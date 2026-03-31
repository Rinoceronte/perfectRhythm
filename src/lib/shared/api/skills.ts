import type {
	ApiResponse,
	SkillCategory,
	SkillDefinitionWithCategory,
	StudentSkillWithDetails,
	SkillSuggestion
} from '$lib/shared/types';
import type {
	CreateSkillCategoryInput,
	CreateSkillDefinitionInput,
	AssignStudentSkillInput,
	UpdateStudentSkillInput
} from '$lib/shared/validation/skills';

const BASE = '/api/v1/skills';

// ---- Categories ----

export async function fetchCategories(): Promise<ApiResponse<SkillCategory[]>> {
	const res = await fetch(`${BASE}/categories`);
	return res.json();
}

export async function createCategory(
	input: CreateSkillCategoryInput
): Promise<ApiResponse<SkillCategory>> {
	const res = await fetch(`${BASE}/categories`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

// ---- Definitions ----

export async function fetchDefinitions(
	categoryId?: string
): Promise<ApiResponse<SkillDefinitionWithCategory[]>> {
	const params = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
	const res = await fetch(`${BASE}/definitions${params}`);
	return res.json();
}

export async function createDefinition(
	input: CreateSkillDefinitionInput
): Promise<ApiResponse<SkillDefinitionWithCategory>> {
	const res = await fetch(`${BASE}/definitions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

// ---- Student Skills ----

export async function fetchStudentSkills(
	coachStudentId: string
): Promise<ApiResponse<StudentSkillWithDetails[]>> {
	const res = await fetch(`${BASE}?coachStudentId=${encodeURIComponent(coachStudentId)}`);
	return res.json();
}

export async function assignStudentSkill(
	input: AssignStudentSkillInput
): Promise<ApiResponse<StudentSkillWithDetails>> {
	const res = await fetch(BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function updateStudentSkill(
	id: string,
	input: UpdateStudentSkillInput
): Promise<ApiResponse<StudentSkillWithDetails>> {
	const res = await fetch(`${BASE}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.json();
}

export async function deleteStudentSkill(
	id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
	const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
	return res.json();
}

export async function triggerAiSuggest(
	coachStudentId: string,
	videoReviewTranscript?: string
): Promise<ApiResponse<{ applied: number; suggestions: SkillSuggestion[] }>> {
	const res = await fetch(`${BASE}/ai-suggest`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ coachStudentId, videoReviewTranscript })
	});
	return res.json();
}

export async function reorderSkills(
	coachStudentId: string,
	orderedIds: string[]
): Promise<ApiResponse<{ reordered: number }>> {
	const res = await fetch(`${BASE}/reorder`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ coachStudentId, orderedIds })
	});
	return res.json();
}
