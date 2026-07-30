import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const BASE =
  'border-edge bg-surface text-ink rounded-control focus:border-accent-500 w-full border px-2.5 text-sm transition-colors outline-none placeholder:text-ink-faint disabled:opacity-50';

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${BASE} h-9 ${className}`} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${BASE} h-9 ${className}`} />;
}

export function TextArea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${BASE} py-2 leading-relaxed ${className}`} />;
}

/** Label + optional hint wrapper, so form rhythm is identical everywhere. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-ink text-xs font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-ink-faint text-xs leading-relaxed">{hint}</p> : null}
    </div>
  );
}
