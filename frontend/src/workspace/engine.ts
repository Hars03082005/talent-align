import type { Candidate, Job, Role } from './model';
import { experienceBand } from './profile';

export const normalize = (value: string) => value.trim().toLowerCase();
const distinct = (values: string[]) => [...new Map(values.map(value => [normalize(value), value])).values()];
const rounded = (value: number) => Math.round(value * 10) / 10;

export function skillGap(required: string[], candidate: string[]) {
  const known = new Set(candidate.map(normalize));
  const skills = distinct(required);
  return { matched: skills.filter(s => known.has(normalize(s))), missing: skills.filter(s => !known.has(normalize(s))) };
}

export function jobFit(job: Job, candidate: Candidate) {
  const required = skillGap(job.skills, candidate.skills);
  const preferred = skillGap(job.preferred, candidate.skills);
  const title = normalize(job.title);
  const target = normalize(candidate.target);
  const candidateLevel = normalize(candidate.level);
  const jobLevel = normalize(job.level);
  const candidateMode = normalize(candidate.mode);
  const jobMode = normalize(job.mode);
  const levelMatch = candidateLevel.includes(jobLevel) || jobLevel.includes(candidateLevel) ||
    (candidateLevel.includes('entry') && jobLevel.includes('1-3'));
  const modeMatch = candidateMode === 'any work arrangement' || jobMode.includes('remote') || candidateMode.includes(jobMode) || jobMode.includes(candidateMode);
  const factors = [
    { label: 'Required skills', points: (job.skills.length ? required.matched.length / job.skills.length : .85) * 40, max: 40 },
    { label: 'Role relevance', points: (target && (title.includes(target) || target.includes(title))) ? 25 : /engineer|developer|architect|analyst/.test(title) ? 17.5 : 10, max: 25 },
    { label: 'Experience level', points: levelMatch ? 15 : 9, max: 15 },
    { label: 'Work arrangement', points: modeMatch ? 10 : 5, max: 10 },
    { label: 'Preferred skills', points: (job.preferred.length ? preferred.matched.length / job.preferred.length : .5) * 10, max: 10 },
  ];
  const raw = factors.reduce((sum, factor) => sum + factor.points, 0);
  return { required, preferred, factors: factors.map(factor => ({ ...factor, points: rounded(factor.points) })), score: rounded(raw) };
}

export interface RolePolicy {
  weights: Record<string, number>;
  interest_category_map: Record<string, string[]>;
  experience_modifiers: Record<string, { readiness_scale: number }>;
  work_style_map: Record<string, { role_families: string[]; boost: number }>;
  output_scores: { personal_fit_components: Record<string, number>; future_potential_components: Record<string, number> };
  recommendation: { top_n: number; min_personal_fit_threshold: number };
}

function weightedScore(components: Record<string, number>, weights: Record<string, number>) {
  return Object.entries(weights).reduce((sum, [key, weight]) => sum + (components[key] ?? 0) * weight, 0);
}

function cosine(a: number[], b: number[]) {
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return norm > 0 ? Math.max(-1, Math.min(1, a.reduce((dot, value, index) => dot + value * b[index], 0) / norm)) : 0;
}

export function rankRoles(roles: Role[], candidate: Candidate, policy: RolePolicy) {
  const candidateSkills = new Set(candidate.skills.map(normalize));
  const preferences = [...new Set([...candidate.interests, ...(candidate.assessmentInterests ?? [])])].slice(0, 6);
  const styles = new Set(candidate.assessmentWorkStyles ?? []);
  if (candidate.preferredWorkStyle) styles.add(candidate.preferredWorkStyle);
  return roles.map(role => {
    const roleSkills = new Set(role.required_skills.map(normalize));
    const overlap = [...candidateSkills].filter(skill => roleSkills.has(skill)).length;
    const readiness = roleSkills.size === 0 ? .5 : candidateSkills.size === 0 ? .2 : overlap / (roleSkills.size + candidateSkills.size - overlap);
    const scale = policy.experience_modifiers[experienceBand(candidate)]?.readiness_scale ?? 1;
    const interest = preferences.reduce((sum, item) => {
      const mapped = policy.interest_category_map[item] ?? [];
      if (mapped.includes(role.role_family ?? '') || mapped.includes(role.role_category ?? '')) return sum + 1;
      return sum + (mapped.some(group => (role.role_family ?? '').includes(group)) ? .5 : 0);
    }, 0);
    const workStyle = [...styles].reduce((sum, item) => {
      const mapped = policy.work_style_map[item];
      return sum + (mapped?.role_families.includes(role.role_family ?? '') ? mapped.boost : 0);
    }, .5);
    const components: Record<string, number> = {
      baio_fit: candidate.assessment ? (1 + cosine(candidate.assessment, role.signals.baio_vector)) / 2 : role.signals.baio_fit,
      future_opportunity: role.signals.future_opportunity,
      emergence_signal: role.signals.emergence_signal,
      interest_alignment: preferences.length ? interest / preferences.length : .5,
      work_style_alignment: Math.min(1, workStyle),
      skill_alignment: Math.min(1, readiness * scale),
    };
    const score = weightedScore(components, policy.weights);
    const personalFit = weightedScore(components, policy.output_scores.personal_fit_components);
    const futurePotential = weightedScore(components, policy.output_scores.future_potential_components);
    return { ...role, score, overlap, components, personalFit, futurePotential, readiness: components.skill_alignment };
  }).sort((a, b) => b.score - a.score);
}
