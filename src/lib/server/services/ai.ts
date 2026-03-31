import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { StudentSkillWithDetails, SkillSuggestion } from '$lib/shared/types';
import { getStudentSkills } from './skills';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function buildSkillPrompt(skillList: StudentSkillWithDetails[], transcript?: string): string {
	return `
You are a west coast swing dance coach assistant. Based on the student's current skill map${transcript ? ' and their video review' : ''}, suggest updated scores.

Current skill map:
${JSON.stringify(
	skillList.map((s) => ({
		id: s.id,
		name: s.skillName,
		category: s.categoryName,
		currentScore: s.currentScore,
		effortToImprove: s.effortToImprove,
		improvementBenefit: s.improvementBenefit
	})),
	null,
	2
)}

${transcript ? `Video review notes:\n${transcript}` : ''}

Return a JSON array of suggested updates. Only include skills that should change.
Format: [{ "skillId": "...", "currentScore": 1-10, "effortToImprove": 1-10, "improvementBenefit": 1-10, "reasoning": "..." }]

Do not include skills you are uncertain about. Only suggest changes you can justify from the available information.
Respond with only the JSON array — no surrounding text.
`.trim();
}

function parseSkillResponse(content: string): SkillSuggestion[] {
	try {
		const parsed = JSON.parse(content);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(item) =>
				typeof item.skillId === 'string' &&
				typeof item.currentScore === 'number' &&
				typeof item.effortToImprove === 'number' &&
				typeof item.improvementBenefit === 'number'
		);
	} catch {
		return [];
	}
}

/**
 * Fetches existing skills, sends them to Claude, and returns suggested updates.
 * Does NOT apply them — caller is responsible for applying via applyAiSuggestions().
 * Locked skills are filtered out before returning.
 */
export async function aiSuggestSkills(
	coachStudentId: string,
	videoReviewTranscript?: string
): Promise<SkillSuggestion[]> {
	const existing = await getStudentSkills(coachStudentId);
	if (existing.length === 0) return [];

	const prompt = buildSkillPrompt(existing, videoReviewTranscript);

	const response = await anthropic.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 2048,
		messages: [{ role: 'user', content: prompt }]
	});

	const textBlock = response.content.find((b) => b.type === 'text');
	if (!textBlock || textBlock.type !== 'text') return [];

	const suggestions = parseSkillResponse(textBlock.text);

	// Filter out coach-locked skills
	const lockedIds = new Set(existing.filter((s) => s.coachLocked).map((s) => s.id));
	return suggestions.filter((s) => !lockedIds.has(s.skillId));
}
