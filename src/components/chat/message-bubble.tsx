'use client';

import { Markdown } from './markdown';

function Avatar({ label, tone }: { label: string; tone: 'user' | 'agent' }) {
  return (
    <span
      aria-hidden
      className={`rounded-control mt-0.5 grid size-6 shrink-0 place-items-center text-[10px] font-semibold ${
        tone === 'user' ? 'bg-surface-muted text-ink-muted' : 'bg-accent-600/15 text-accent-500'
      }`}
    >
      {label}
    </span>
  );
}

export function MessageBubble({
  role,
  content,
  agentName,
}: {
  role: 'user' | 'assistant';
  content: string;
  agentName: string;
}) {
  const isUser = role === 'user';

  return (
    <article className="flex gap-3">
      <Avatar
        label={isUser ? 'You' : agentName.slice(0, 2).toUpperCase()}
        tone={isUser ? 'user' : 'agent'}
      />
      <div className="min-w-0 flex-1">
        <p className="text-ink-faint mb-1 text-[11px] font-medium">{isUser ? 'You' : agentName}</p>
        {isUser ? (
          // The user's own words: shown verbatim, never re-interpreted as markup.
          <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <Markdown>{content}</Markdown>
        )}
      </div>
    </article>
  );
}
