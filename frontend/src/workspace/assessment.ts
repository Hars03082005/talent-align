import questionBank from '../../../backend/questionnaire.json';
import policy from './assessment.generated.json';

export const archetypes = policy.archetypes;
export const archetypeDescriptions: Record<string, string> = policy.descriptions;
export const TOTAL_QUESTIONS = policy.total;
export const questionTypes: Record<string, string> = {
  mcq: 'Multiple choice',
  binary: 'Yes or no',
  likert: 'Agreement scale',
};

type Question = typeof questionBank[number];
type Answer = { id: string; text: string };
type Branch = { adaptive: string[]; reconfirmation: string[] };
type AssessmentState = ReturnType<typeof beginAssessment>;

const questionById = new Map(questionBank.map(question => [question.id, question]));
const branches: Record<string, Branch> = policy.branches;

function resolveQuestions(ids: string[]): Question[] {
  return ids.map(id => {
    const question = questionById.get(id);
    if (!question) throw new Error('Unknown questionnaire item: ' + id);
    return question;
  });
}

export function beginAssessment() {
  return { pending: resolveQuestions(policy.first), answers: [] as Answer[], vector: [0, 0, 0, 0] };
}

function orderTraits(vector: number[]) {
  return [0, 1, 2, 3].sort((a, b) => vector[b] - vector[a] || a - b);
}

export function answerAssessment(state: AssessmentState, selected: number): AssessmentState {
  const [question, ...remaining] = state.pending;
  const answer = question?.options[selected];
  if (!answer || state.answers.length >= TOTAL_QUESTIONS) return state;

  const answers = [...state.answers, { id: question.id, text: answer.text }];
  const vector = state.vector.map((value, index) => value + answer.weights[index]);
  let pending = remaining;

  if (!pending.length && answers.length < TOTAL_QUESTIONS) {
    const branch = branches[orderTraits(vector).slice(0, 3).join('')];
    pending = resolveQuestions(answers.length === policy.first.length ? branch.adaptive : branch.reconfirmation);
  }
  return { pending, answers, vector };
}

function countTags<T>(values: T[], findTags: (value: T) => string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    for (const tag of findTags(value)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

export function buildAssessmentProfile(state: AssessmentState) {
  const sum = state.vector.reduce((total, value) => total + value, 0);
  const normalized = state.vector.map(value => sum > 0 ? value / sum : .25);
  const [primary, secondary] = orderTraits(normalized);

  const interests = countTags(state.answers, answer => {
    const matched = policy.interestPrefixes.find(([prefix]) => answer.id.toLowerCase().startsWith(prefix));
    return matched ? [matched[1]] : [];
  }, 5);

  const workStyles = countTags(state.answers, answer => {
    const text = answer.text.toLowerCase();
    return policy.workStyleKeywords.filter(([keyword]) => text.includes(keyword)).map(([, style]) => style);
  }, 3);

  return {
    vector: normalized.map(value => Number(value.toFixed(4))),
    primary: archetypes[primary],
    secondary: archetypes[secondary],
    interests,
    workStyles,
  };
}
