import type { Candidate } from './model';

export const educationLevels = ['High school', 'Diploma', 'Bachelor’s', 'Master’s', 'Doctorate'];
export const workModes = ['Any work arrangement', 'Remote', 'Hybrid', 'On-site'];
export const experienceBands: Record<string, string> = {
  'Student / Fresher': 'Student or fresher',
  '0-1 years': 'Under 1 year',
  '1-3 years': '1–3 years',
  '3-5 years': '3–5 years',
  '5+ years': '5+ years',
};
const jobLevels: Record<string, string> = {
  'Student / Fresher': 'Entry Level',
  '0-1 years': 'Entry Level',
  '1-3 years': 'Mid Level',
  '3-5 years': 'Senior Level',
  '5+ years': 'Lead / Principal',
};
const previousLevels: Record<string, string> = {
  'Entry Level': '0-1 years',
  'Mid Level': '1-3 years',
  'Senior Level': '3-5 years',
  'Lead / Principal': '5+ years',
};

export const blankCandidate: Candidate = { name: '', skills: [], level: 'Entry Level', mode: workModes[0], target: '', interests: [] };

export function experienceBand(candidate: Candidate) {
  return candidate.experienceBand || previousLevels[candidate.level] || '';
}

export function setExperienceBand(candidate: Candidate, band: string): Candidate {
  return { ...candidate, experienceBand: band, level: jobLevels[band] || candidate.level };
}

export function experienceFromYears(years: number): string {
  if (years < 1) return '0-1 years';
  if (years < 3) return '1-3 years';
  return years < 5 ? '3-5 years' : '5+ years';
}
