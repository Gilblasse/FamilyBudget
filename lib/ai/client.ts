import { openai } from '@ai-sdk/openai';

export const FAST_MODEL = openai('gpt-5-mini');
export const SMART_MODEL = openai('gpt-5');

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const ANSI_RE = /\[[0-9;]*m/g;

export function describeAiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : 'Unknown error';
  const clean = raw.replace(ANSI_RE, '').trim();
  if (/unauthenticated|invalid api key|incorrect api key|401/i.test(clean)) {
    return {
      status: 503,
      message: 'OpenAI rejected the key. Check OPENAI_API_KEY in .env.local.',
    };
  }
  if (/quota|insufficient_quota|rate.?limit|429/i.test(clean)) {
    return { status: 429, message: 'OpenAI quota or rate limit reached. Try again shortly.' };
  }
  if (/model_not_found|does not exist|404/i.test(clean)) {
    return {
      status: 502,
      message: 'OpenAI does not recognize the configured model. Check FAST_MODEL / SMART_MODEL in lib/ai/client.ts.',
    };
  }
  return { status: 502, message: clean.slice(0, 300) };
}
