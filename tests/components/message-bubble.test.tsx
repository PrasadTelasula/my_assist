import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MessageBubble } from '@/components/chat/message-bubble';

const REPLY = `I have access to these tools:

- **get_time**: the current time.
- **search**: looks things up.

Use \`get_time\` when asked about the clock.`;

describe('MessageBubble', () => {
  it('renders an assistant reply as markdown, not literal asterisks', () => {
    render(<MessageBubble role="assistant" content={REPLY} agentName="Apfel" />);

    // The bug this guards: ** and - shown verbatim in one run-on paragraph.
    expect(screen.queryByText(/\*\*get_time\*\*/)).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('get_time', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('get_time', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByText('Apfel')).toBeInTheDocument();
  });

  it('shows the user their own text verbatim', () => {
    render(<MessageBubble role="user" content="use **stars** literally" agentName="Apfel" />);

    expect(screen.getByText('use **stars** literally')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
