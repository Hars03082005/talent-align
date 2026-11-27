import type { Candidate } from './model';

export interface AssessmentResult {
  vector: number[];
  interests: string[];
  workStyles: string[];
  completedAt: number | null;
}

export function readAssessmentResult(value: unknown): AssessmentResult | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Partial<AssessmentResult>;
  const vector = result.vector;
  const interests = result.interests;
  const workStyles = result.workStyles;
  const time = result.completedAt;
  if (!Array.isArray(vector) || vector.length !== 4 || !vector.every(score => typeof score === 'number' && Number.isFinite(score) && score >= 0)) return null;
  const sum = vector.reduce((total, score) => total + score, 0);
  if (sum <= 0 || sum > 30) return null;
  if (!Array.isArray(interests) || interests.length > 5 || !interests.every(tag => typeof tag === 'string' && tag.length <= 80)) return null;
  if (!Array.isArray(workStyles) || workStyles.length > 3 || !workStyles.every(tag => typeof tag === 'string' && tag.length <= 80)) return null;
  if (time !== null && (typeof time !== 'number' || !Number.isSafeInteger(time) || time <= 0)) return null;
  return { vector, interests, workStyles, completedAt: time };
}

export function previousAssessment(candidate: Candidate | null) {
  return readAssessmentResult({
    vector: candidate?.assessment,
    interests: candidate?.assessmentInterests ?? [],
    workStyles: candidate?.assessmentWorkStyles ?? [],
    completedAt: null,
  });
}

export function applyAssessment(candidate: Candidate, result: AssessmentResult): Candidate {
  return {
    ...candidate,
    assessment: result.vector,
    assessmentInterests: result.interests,
    assessmentWorkStyles: result.workStyles,
  };
}
