export const STRUCTURED_OWNER_OPTIONS: Record<string, readonly string[]> = {
  q_712_papers: ["Available", "Not available", "Unclear"],
  q_road_legal: ["Shown in papers", "Not shown in papers", "Unclear"],
  q_loan_dispute: ["No known issue", "Issue indicated", "Unclear"]
};

export function isStructuredOwnerQuestion(id: string): boolean {
  return Boolean(STRUCTURED_OWNER_OPTIONS[id]);
}

export function isStructuredOwnerAnswer(id: string, value: string | undefined): boolean {
  if (!value) return false;
  return STRUCTURED_OWNER_OPTIONS[id]?.includes(value) ?? false;
}

export function isLegacyOwnerAnswer(id: string, value: string | undefined): boolean {
  return Boolean(value?.trim()) && isStructuredOwnerQuestion(id) && !isStructuredOwnerAnswer(id, value);
}
