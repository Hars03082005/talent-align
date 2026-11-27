import { useEffect, useState } from 'react';
import { readAssessmentResult } from './assessmentResult';
import type { AssessmentResult } from './assessmentResult';

const endpoint = '/api/workspace/assessment';
const storagePrefix = 'talentalign.workspace.assessment.';
const hosted = import.meta.env.MODE === 'site';

function readCached(key: string) {
  try { return readAssessmentResult(JSON.parse(localStorage.getItem(storagePrefix + key) ?? 'null')); }
  catch { return null; }
}

function cache(key: string, result: AssessmentResult) {
  try {
    localStorage.setItem(storagePrefix + key, JSON.stringify(result));
    return true;
  } catch { return false; }
}

type SyncState = 'checking' | 'saving' | 'account' | 'browser' | 'memory';

interface AccountAssessment {
  account: string;
  result: AssessmentResult | null;
}

async function accountAssessment(options?: RequestInit): Promise<AccountAssessment | null> {
  const response = await fetch(endpoint, options);
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data.account === 'string' ? { account: data.account, result: readAssessmentResult(data.result) } : null;
}

async function sync(result: AssessmentResult, signal?: AbortSignal) {
  try {
    return await accountAssessment({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
      signal,
    });
  } catch { return null; }
}

export function useSavedAssessment(legacy: AssessmentResult | null) {
  const [account, setAccount] = useState<string | null>(null);
  const [result, setResult] = useState(() => readCached('browser'));
  const [status, setStatus] = useState<SyncState>(hosted ? 'checking' : 'browser');

  useEffect(() => {
    if (!hosted) return;
    const controller = new AbortController();
    async function load() {
      try {
        const saved = await accountAssessment({ signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!saved) {
          setStatus('browser');
          return;
        }
        const local = readCached(saved.account);
        setAccount(saved.account);
        if ((local?.completedAt ?? 0) > (saved.result?.completedAt ?? 0) && local) {
          setResult(local);
          setStatus('saving');
          const updated = await sync(local, controller.signal);
          if (controller.signal.aborted) return;
          if (updated?.result) {
            cache(saved.account, updated.result);
            setResult(updated.result);
            setStatus('account');
          } else {
            setStatus('browser');
          }
          return;
        }
        // Existing device-only results stay usable when the account has no result.
        if (saved.result) {
          cache(saved.account, saved.result);
          setResult(saved.result);
          setStatus('account');
        } else {
          setStatus('browser');
        }
      } catch {
        if (!controller.signal.aborted) setStatus('browser');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function saveAssessment(next: AssessmentResult) {
    const localSaved = cache(account ?? 'browser', next);
    setResult(next);
    setStatus(account ? 'saving' : localSaved ? 'browser' : 'memory');
    if (!account) return;
    const updated = await sync(next);
    if (updated?.result) {
      cache(account, updated.result);
      setResult(updated.result);
      setStatus('account');
    } else {
      setStatus(localSaved ? 'browser' : 'memory');
    }
  }

  return { result: result ?? legacy, status, saveAssessment };
}
