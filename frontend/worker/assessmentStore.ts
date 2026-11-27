import { readAssessmentResult } from '../src/workspace/assessmentResult';

interface Statement {
  bind(...values: (string | number)[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface AssessmentEnv {
  DB?: { prepare(sql: string): Statement };
}

const headers = { 'Cache-Control': 'private, no-store' };

export async function assessmentStore(request: Request, env: AssessmentEnv) {
  const reply = (value: object, status = 200) => Response.json(value, { headers, status });
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, PUT' } });
  }

  const userId = request.headers.get('oai-authenticated-user-id');
  const db = env.DB;
  if (!userId) return reply({ error: 'Sign in to sync your assessment.' }, 401);
  if (!db) return reply({ error: 'Assessment storage unavailable.' }, 503);

  try {
    if (request.method === 'PUT') {
      const origin = request.headers.get('origin');
      if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
        return reply({ error: 'Origin not allowed.' }, 403);
      }
      if (!request.headers.get('content-type')?.startsWith('application/json')) {
        return reply({ error: 'Expected JSON.' }, 415);
      }
      if (Number(request.headers.get('content-length')) > 4096) return reply({ error: 'Assessment is too large.' }, 413);
      const text = await request.text();
      if (text.length > 4096) return reply({ error: 'Assessment is too large.' }, 413);
      let data: unknown;
      try { data = JSON.parse(text); } catch { return reply({ error: 'Invalid JSON.' }, 400); }
      const result = readAssessmentResult(data);
      if (!result?.completedAt || result.completedAt > Date.now() + 60_000) {
        return reply({ error: 'Invalid assessment result.' }, 400);
      }
      await db.prepare(
        'INSERT INTO saved_assessments (user_id, result, completed_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET result = excluded.result, completed_at = excluded.completed_at ' +
        'WHERE excluded.completed_at >= saved_assessments.completed_at',
      ).bind(userId, JSON.stringify(result), result.completedAt).run();
    }
    const row = await db.prepare('SELECT result FROM saved_assessments WHERE user_id = ?')
      .bind(userId).first<{ result: string }>();
    return reply({ account: userId, result: row ? readAssessmentResult(JSON.parse(row.result)) : null });
  } catch (error) {
    console.error('Assessment storage operation failed', error instanceof Error ? error.name : 'Unknown error');
    return reply({ error: 'Assessment storage unavailable.' }, 503);
  }
}
