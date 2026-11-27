import catalog from '../src/workspace/catalog.generated.json';
import type { Feed, Job } from '../src/workspace/model';

const boards = [
  { token: 'databricks', company: 'Databricks' },
  { token: 'gitlab', company: 'GitLab' },
  { token: 'mongodb', company: 'MongoDB' },
  { token: 'rubrik', company: 'Rubrik' },
  { token: 'okta', company: 'Okta' },
  { token: 'twilio', company: 'Twilio' },
  { token: 'stripe', company: 'Stripe' },
  { token: 'coinbase', company: 'Coinbase' },
];

type Board = typeof boards[number];
type Listing = {
  id?: number; internal_job_id?: number | null; title?: string;
  location?: { name?: string }; content?: string; updated_at?: string;
  first_published?: string; absolute_url?: string; language?: string;
};

const india = /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|gurugram|gurgaon|chennai|noida|new delhi|kolkata|ahmedabad)\b/i;
const technology = /\b(software|engineer|developer|data scientist|data analyst|machine learning|technolog|architecture|architect|security|platform|devops|automation|reliability|qa|analytics|programmer|internship)/i;
const unrelated = /\b(recruit|sales|accountant|facilities|legal|auditor|human resources|account executive|finance|marketing)\b/i;
const requirementTitle = /^(?:(?:minimum|basic|required|essential|technical|preferred|desired)\s+)?(?:qualifications|requirements|skills)(?:\s+and\s+(?:experience|qualifications))?\b|^what (?:you(?:'ll| will) (?:bring|need)|we(?:'re| are) looking for)|^who you are|^about you|^you(?:'ll| will) have/i;
const preferredTitle = /\b(preferred|desired|bonus|nice[- ]to[- ]have)\b/i;
const sectionEnd = /^(?:benefits|compensation|salary|about (?:us|the company|our team)|what we (?:offer|do)|what you(?:'ll| will) do|responsibilities|equal opportunity|our commitment|why (?:join|work)|perks|life at)\b/i;

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', bull: '•' };
function decode(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] !== '#') return entities[code.toLowerCase()] ?? match;
    const number = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
  });
}

export function textLines(html: string) {
  return decode(decode(html)).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(?:p|li|h[1-6]|div|section|tr|ul|ol)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ').split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const wordPattern = (value: string) => value.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
const compiled = Object.entries(catalog.vocabulary).filter(([name]) => name.length > 2 || ['c#', 'c++'].includes(name))
  .map(([word, skill]) => [new RegExp('(^|[^\\p{L}\\p{N}_])' + wordPattern(word) + '(?=$|[^\\p{L}\\p{N}_])', 'iu'), skill] as const);

function skillsFrom(lines: string[]) {
  const hits = new Map<string, string>();
  for (const line of lines) {
    for (const [regex, name] of compiled) {
      if (regex.test(line)) hits.set(name.toLowerCase(), name);
    }
    if (/\b(?:experience (?:with|in)|proficient in|knowledge of|(?:Python|Java),)\s+Go\b|\bGo(?:lang)? (?:language|programming)\b/.test(line)) hits.set('go', 'Go');
  }
  return [...hits.values()];
}

export function evidenceFrom(html: string) {
  const lines = textLines(html);
  const required: string[] = [];
  const preferred: string[] = [];
  let section = '';
  for (const line of lines) {
    if (line.length < 150 && sectionEnd.test(line)) {
      section = '';
      continue;
    }
    const inlinePreferred = preferredTitle.test(line);
    if (line.length < 115 && (requirementTitle.test(line) || (inlinePreferred && line.length < 45))) {
      section = inlinePreferred ? 'preferred' : 'required';
      const rest = line.includes(':') ? line.slice(line.indexOf(':') + 1).trim() : '';
      if (rest.length > 8) (section === 'required' ? required : preferred).push(rest);
      continue;
    }
    if (section && line.length < 750) {
      (inlinePreferred || section === 'preferred' ? preferred : required).push(line);
    } else if (line.length < 450 && /^(?:\d+\+?\s+years?|experience (?:with|in|building)|proficien(?:t|cy)|knowledge of|bachelor|master|strong (?:understanding|knowledge|experience)|hands-on experience)/i.test(line)) {
      (inlinePreferred ? preferred : required).push(line);
    }
  }
  const requiredSkills = skillsFrom(required.slice(0, 26));
  const preferredSkills = skillsFrom(preferred.slice(0, 18)).filter(skill => !requiredSkills.some(other => other.toLowerCase() === skill.toLowerCase()));
  const qualifications = [...required, ...preferred].filter(line => /\b(?:\d+\+?\s+years?|bachelor|master'?s|degree|phd|doctorate|certification|work authori[sz]ation|visa sponsorship)\b/i.test(line)).slice(0, 4);
  const summary = lines.find(line => line.length > 90 && !/equal opportunity|candidate privacy|cookies|^[A-Z]+:|join our talent|greenhouse/i.test(line)) ?? '';
  return { skills: requiredSkills.slice(0, 16), preferred: preferredSkills.slice(0, 10), qualifications, summary: summary.length > 310 ? summary.slice(0, 307).trimEnd() + '…' : summary };
}

export const isIndia = (location: string) => india.test(location);

function modeFrom(title: string, location: string, lines: string) {
  const header = title + ' ' + location;
  if (/\bhybrid\b/i.test(header) || /\bhybrid (?:role|work|position|schedule|model|environment)\b/i.test(lines)) return 'Hybrid';
  if (/\b(remote|work from home)\b/i.test(header) || /\b(?:fully remote|100% remote|remote-first|this (?:role|position) is remote)\b/i.test(lines)) return 'Remote';
  if (/\b(on[- ]?site|in-office)\b/i.test(header) || /\b(?:this (?:role|position) is on[- ]?site|work on[- ]?site)\b/i.test(lines)) return 'On-site';
  return 'Unspecified';
}

function levelFrom(title: string, qualifications: string[]) {
  if (/\b(intern(?:ship)?|junior|early career|entry[- ]level|new grad|graduate|associate|engineer i|engineer 1)\b/i.test(title)) return 'Entry Level';
  if (/\b(staff|lead|principal|manager|director|head of|architect)\b/i.test(title)) return 'Lead / Principal';
  if (/\b(senior|sr\.?|engineer iii|engineer 3)\b/i.test(title)) return 'Senior Level';
  if (/\b(engineer ii|engineer 2|mid[- ]level)\b/i.test(title)) return 'Mid Level';
  const statedYears = qualifications.flatMap(line => [...line.matchAll(/\b(\d{1,2})\s*\+?\s*(?:[-–]\s*\d{1,2}\s*)?years?\b/gi)].map(match => Number(match[1])));
  if (statedYears.length) {
    const minimum = Math.max(...statedYears);
    if (minimum <= 1) return 'Entry Level';
    if (minimum <= 3) return 'Mid Level';
    if (minimum <= 6) return 'Senior Level';
  }
  return 'Unspecified';
}

export function httpsUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

async function boardJobs(board: Board): Promise<Job[]> {
  const response = await fetch('https://boards-api.greenhouse.io/v1/boards/' + board.token + '/jobs?content=true', {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(9500),
  });
  if (!response.ok) throw new Error('Employer board returned ' + response.status);
  const payload = await response.json() as { jobs?: Listing[] };
  if (!Array.isArray(payload.jobs)) throw new Error('Invalid employer board response');
  const results = payload.jobs.filter(listing => listing.id && listing.internal_job_id !== null &&
    listing.title && technology.test(listing.title) && !unrelated.test(listing.title) &&
    (!listing.language || listing.language === 'en') && httpsUrl(listing.absolute_url ?? ''));
  results.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  const inIndia = results.filter(job => isIndia(job.location?.name ?? ''));
  const remote = results.filter(job => !isIndia(job.location?.name ?? '') && /\bremote\b/i.test((job.location?.name ?? '') + ' ' + job.title));
  const global = results.filter(job => !isIndia(job.location?.name ?? '') && !remote.includes(job));
  return [...inIndia.slice(0, 27), ...remote.slice(0, 10), ...global.slice(0, 4)].map(listing => {
    const title = listing.title!.replace(/\s+/g, ' ').trim();
    const location = listing.location?.name?.trim() || 'Location unspecified';
    const description = listing.content ?? '';
    const evidence = evidenceFrom(description);
    return {
      id: board.token + '-' + listing.id, title, company: board.company, location,
      mode: modeFrom(title, location, textLines(description).slice(0, 38).join(' ')),
      level: levelFrom(title, evidence.qualifications), source: 'Greenhouse', url: httpsUrl(listing.absolute_url!),
      published: listing.first_published ?? null, updated: listing.updated_at ?? null,
      ...evidence,
    };
  });
}

export async function collectFeed(): Promise<Feed> {
  const jobs = new Map<string, Job>();
  const unavailable: string[] = [];
  const sources: string[] = [];
  // Bound memory held by large employer-board payloads during concurrent fetches.
  for (let offset = 0; offset < boards.length; offset += 4) {
    const batch = boards.slice(offset, offset + 4);
    const results = await Promise.allSettled(batch.map(boardJobs));
    results.forEach((result, index) => {
      const board = batch[index];
      if (result.status === 'rejected') { unavailable.push(board.company); return; }
      sources.push(board.company);
      for (const job of result.value) {
        const key = [job.company, job.title, job.location].map(v => v.trim().toLowerCase()).join('|');
        if (!jobs.has(key)) jobs.set(key, job);
      }
    });
  }
  return { jobs: [...jobs.values()], checked: new Date().toISOString(), sources, unavailable, status: 'live' };
}
