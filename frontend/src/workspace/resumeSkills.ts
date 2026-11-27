import catalog from './catalog.generated.json';

const escapeWord = (value: string) => value.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
const vocabulary = new Map(Object.entries(catalog.vocabulary));
const ambiguousShortNames = new Set(['py', 'ts', 'js', 'ai', 'ml', 'go', 'r', 'c']);

const patterns = [...vocabulary].filter(([word]) => !ambiguousShortNames.has(word.toLowerCase()))
  .map(([word, canonical]) => {
    const flags = word === 'rest' ? 'u' : 'iu';
    return [new RegExp('(?:^|[^\\p{L}\\p{N}_])' + escapeWord(word) + '(?=$|[^\\p{L}\\p{N}_])', flags), canonical] as const;
  });

export function extractResumeSkills(text: string): string[] {
  const original = text.normalize('NFKC').replace(/\u00ad/g, '');
  const singleLine = original.replace(/\s+/g, ' ');
  const unique = new Map<string, { name: string; index: number }>();
  const add = (name: string, index: number) => {
    const key = name.toLowerCase();
    if (index >= 0 && (unique.get(key)?.index ?? Infinity) > index) unique.set(key, { name, index });
  };
  for (const [pattern, skill] of patterns) add(skill, singleLine.search(pattern));

  // Match Go in a technology list or when explicitly named as a language.
  add('Go', original.search(/\b(?:Golang|Go\s+(?:programming|language))\b|(?:languages?|skills?)\s*:[^\n]{0,100}\bGo\b(?=\s*[,;|/.\n]|$)/im));
  return [...unique.values()].sort((a, b) => a.index - b.index || a.name.localeCompare(b.name)).map(item => item.name);
}
