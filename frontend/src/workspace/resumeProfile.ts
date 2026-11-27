import { experienceFromYears } from './profile';
import { extractResumeSkills } from './resumeSkills';

export interface ResumeDetails {
  name?: string;
  education?: string;
  degreeStream?: string;
  experience?: { display: string; band: string };
}

export interface ResumeDraft {
  details: ResumeDetails;
  skills: string[];
}

const nonName = /\b(?:curriculum|resume|vitae|summary|profile|contact|education|skills|experience|portfolio|career|objective|student|graduate|university|college|school|engineer|engineering|technical|software|developer|analyst|scientist|manager|research|associate|specialist)\b/i;
const nameShape = /^[\p{L}\p{M}][\p{L}\p{M}.'’\-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}.'’\-]*){0,4}$/u;
const degreePatterns: ReadonlyArray<readonly [string, RegExp]> = [
  ['Doctorate', /\b(?:doctor(?:ate| of philosophy)|ph\.?\s*d\.?|d\.?\s*phil\.?)\b/i],
  ['Master’s', /\b(?:master(?:['’]s|\s+of|\s+degree)|m\.?\s*tech\.?|m\.s(?:c)?(?=\.?\s*(?:$|[,(/:–-]|in\b|\d{4}))|m\.e(?=\.?\s*(?:$|[,(/:–-]|in\b|\d{4}))|m\.b\.a\.?|m\.c\.a\.?)\b/i],
  ['Bachelor’s', /\b(?:bachelor(?:['’]s|\s+of|\s+degree)|b\.?\s*tech\.?|b\.s(?:c)?(?=\.?\s*(?:$|[,(/:–-]|in\b|\d{4}))|b\.e(?=\.?\s*(?:$|[,(/:–-]|in\b|\d{4}))|b\.c\.a\.?|b\.b\.a\.?|b\.com\.?)\b/i],
  ['Diploma', /\b(?:diploma|polytechnic)\b/i],
  ['High school', /\b(?:high school|higher secondary|senior secondary|class 12|pre-university)\b/i],
];
const fields: ReadonlyArray<readonly [string, RegExp]> = [
  ['Computer Science & Engineering', /\b(?:computer science(?: and engineering| & engineering)?|c\.?s\.?e\.?)\b/i],
  ['Information Technology', /\binformation technology\b/i],
  ['Artificial Intelligence & Machine Learning', /\b(?:artificial intelligence|machine learning|ai\s*(?:&|and|\/)\s*ml)\b/i],
  ['Data Science & Analytics', /\b(?:data science|data analytics)\b/i],
  ['Computer Applications', /\bcomputer applications?\b/i],
  ['Electronics & Communication Engineering', /\b(?:electronics and communication|electronics & communication|ece)\b/i],
  ['Electrical Engineering', /\belectrical(?: and electronics)? engineering\b/i],
  ['Mechanical Engineering', /\bmechanical engineering\b/i],
  ['Civil Engineering', /\bcivil engineering\b/i],
  ['Mathematics & Statistics', /\b(?:statistics|mathematics)\b/i],
  ['Business & Management', /\b(?:business administration|management studies|commerce)\b/i],
];
const nextSection = /^(?:technical skills|skills|projects|experience|work experience|internships|certifications|awards|publications|activities|languages|achievements|portfolio)(?:\s*[:–—-].*)?$/i;

function findName(lines: string[]) {
  for (const line of lines.slice(0, 7)) {
    const labeled = line.match(/^name\s*:\s*(.+)$/i);
    const candidate = (labeled?.[1] ?? line.split(/\s*[|•]\s*/)[0]).trim();
    if (candidate.length < 2 || candidate.length > 60 || !nameShape.test(candidate) || nonName.test(candidate)) continue;
    if (labeled || candidate.split(/\s+/).length >= 2) return candidate;
  }
}

function findEducation(lines: string[]) {
  const section = lines.findIndex(line => /^education(?:\s*[:–—-]|$)|^academic (?:background|qualifications|details)\b/i.test(line));
  let candidates = lines;
  if (section >= 0) {
    const after = lines.slice(section + 1, section + 16);
    const stop = after.findIndex(line => nextSection.test(line));
    candidates = [lines[section], ...(stop < 0 ? after : after.slice(0, stop))];
  }
  for (const [education, pattern] of degreePatterns) {
    const degreeLine = candidates.findIndex(line => pattern.test(line));
    if (degreeLine >= 0) {
      const context = candidates.slice(degreeLine, degreeLine + 2).join(' ');
      const degreeStream = fields.find(([, fieldPattern]) => fieldPattern.test(context))?.[0];
      return { education, ...(degreeStream ? { degreeStream } : {}) };
    }
  }
  return {};
}

function findExperience(text: string): ResumeDetails['experience'] {
  const match = text.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:(?:professional|relevant|industry|work|hands-on)\s+)*experience\b/i)
    ?? text.match(/\b(?:professional |work |total )?experience\s*:\s*(\d{1,2}(?:\.\d{1,2})?)\s*(\+)?\s*(?:years?|yrs?)\b/i);
  if (!match) return;
  const years = Number(match[1]);
  if (years > 60) return;
  return {
    display: match[1] + (match[2] ?? '') + (years === 1 && !match[2] ? ' year' : ' years'),
    band: experienceFromYears(years),
  };
}

export function extractResumeProfile(text: string): ResumeDraft {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const name = findName(lines);
  const experience = findExperience(lines.join(' '));
  const details: ResumeDetails = {
    ...(name ? { name } : {}),
    ...findEducation(lines),
    ...(experience ? { experience } : {}),
  };
  const skillsText = text.replace(/(?:https?:\/\/|www\.)\S+|\S+@\S+/gi, ' ');
  return { details, skills: extractResumeSkills(skillsText) };
}
