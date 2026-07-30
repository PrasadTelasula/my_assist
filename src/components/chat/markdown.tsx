'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Models answer in markdown. Rendering it as plain text collapses lists and
 * leaves ** markers on screen, which is what made replies unreadable.
 * Raw HTML stays disabled (react-markdown's default) — model output is
 * untrusted input.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-ink text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 ml-1 list-outside list-disc space-y-1 pl-4 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-1 list-outside list-decimal space-y-1 pl-4 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="text-ink font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 mb-2 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h3>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent-500 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) =>
            className?.startsWith('language-') ? (
              <code className={`${className} font-mono text-[12.5px]`}>{children}</code>
            ) : (
              <code className="bg-surface-muted border-edge rounded border px-1 py-0.5 font-mono text-[12.5px]">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="bg-surface-muted border-edge rounded-control mb-3 overflow-x-auto border p-3 last:mb-0">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-edge text-ink-muted mb-3 border-l-2 pl-3 last:mb-0">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="w-full text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-edge border-b px-2 py-1 font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-edge border-b px-2 py-1">{children}</td>,
          hr: () => <hr className="border-edge my-4" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
