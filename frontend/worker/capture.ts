import { writeFile } from 'node:fs/promises';
import { collectFeed } from './feed';

const feed = await collectFeed();
if (!feed.jobs.length) throw new Error('No verified employer listings available. Preserving the previous snapshot.');
await writeFile('src/workspace/jobs.snapshot.json', JSON.stringify({ ...feed, status: 'snapshot' }) + '\n');
console.log(feed.jobs.length + ' jobs from ' + feed.sources.length + ' employer boards, checked ' + feed.checked);
