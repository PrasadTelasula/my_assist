import { MockLanguageModelV4 } from 'ai/test';

import { registerFakeModel } from '@/core/model-registry';

const USAGE = {
  inputTokens: { total: 25, noCache: 25, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 12, text: 12, reasoning: 0 },
};

interface PromptPart {
  type?: string;
  toolName?: string;
}
interface PromptMessage {
  role: string;
  content: string | PromptPart[];
}

function toolCallsMade(prompt: PromptMessage[]): string[] {
  return prompt
    .filter((m) => m.role === 'assistant' && Array.isArray(m.content))
    .flatMap((m) => (m.content as PromptPart[]).filter((p) => p.type === 'tool-call'))
    .map((p) => p.toolName ?? '');
}

/**
 * The MY_ASSIST_PROVIDER=fake model: deterministic, key-free, tool-aware.
 * It reads which tools each run offers and behaves accordingly — work a task
 * to completion, plan two stories, post a review, or answer a chat — so demos
 * and e2e cover every flow without an API key.
 */
export function registerDemoFakeModel(): void {
  registerFakeModel(
    () =>
      new MockLanguageModelV4({
        modelId: 'demo',
        doGenerate: async (options) => {
          const tools = (options.tools ?? []).map((t) => ('name' in t ? t.name : ''));
          const made = toolCallsMade(options.prompt as PromptMessage[]);
          const call = (toolName: string, input: Record<string, unknown>) => ({
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: `tc_${made.length + 1}`,
                toolName,
                input: JSON.stringify(input),
              },
            ],
            finishReason: { unified: 'tool-calls' as const, raw: 'tool_use' },
            usage: USAGE,
            warnings: [],
          });
          const reply = (text: string) => ({
            content: [{ type: 'text' as const, text }],
            finishReason: { unified: 'stop' as const, raw: 'end_turn' },
            usage: USAGE,
            warnings: [],
          });

          if (tools.includes('post_review') && !made.includes('post_review')) {
            return call('post_review', {
              verdict: 'approve',
              findings: 'The summary matches the task; nothing blocking.',
            });
          }
          if (tools.includes('create_story')) {
            if (made.filter((t) => t === 'create_story').length < 2) {
              return call('create_story', {
                title: `Demo story ${made.length + 1}`,
                description: 'Planned by the demo model to illustrate goal decomposition.',
                points: 3,
              });
            }
            if (!made.includes('finish_planning')) {
              return call('finish_planning', { summary: 'Two demo stories planned.' });
            }
            return reply('Planning complete.');
          }
          if (tools.includes('complete_task')) {
            if (!made.includes('post_update')) {
              return call('post_update', { message: 'Picked up the card, working it now.' });
            }
            if (!made.includes('complete_task')) {
              return call('complete_task', { summary: 'Demo work finished; ready for review.' });
            }
            return reply('Card moved to review.');
          }
          if (tools.includes('get_time') && !made.includes('get_time')) {
            return call('get_time', {});
          }
          return reply('Demo reply: everything is wired up and working.');
        },
      }),
  );
}
