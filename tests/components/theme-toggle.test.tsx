import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeToggle } from '@/components/shell/theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('offers the opposite theme and applies it on click', async () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: 'Switch to light theme' });
    fireEvent.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('my-assist-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('switches a light page to dark and remembers the choice', async () => {
    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: 'Switch to dark theme' });
    fireEvent.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('my-assist-theme')).toBe('dark');
  });
});
