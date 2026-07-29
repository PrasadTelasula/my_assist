'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '@/lib/api';

export function PlanFromGoalForm({
  sprintId,
  agents,
  onDone,
}: {
  sprintId: string;
  agents: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [agentId, setAgentId] = useState('');

  const plan = useMutation({
    mutationFn: () => api.sprints.plan(sprintId, { goal, agentId }),
    onSuccess: onDone,
  });

  return (
    <form
      className="border-edge bg-surface rounded-panel m-4 flex flex-col gap-2 border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (goal.trim() && agentId) plan.mutate();
      }}
    >
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Describe the sprint goal — the planner agent decomposes it into backlog stories for you to curate."
        aria-label="Sprint goal"
        rows={3}
        className="border-edge bg-surface text-ink rounded-control border px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          aria-label="Planner agent"
          className="border-edge bg-surface text-ink rounded-control border px-2 py-1.5 text-sm"
        >
          <option value="">Choose a planner agent…</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!goal.trim() || !agentId || plan.isPending}
          className="bg-accent-600 hover:bg-accent-700 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {plan.isPending ? 'Planning…' : 'Fill the backlog'}
        </button>
        {plan.isError ? (
          <p className="text-destructive text-xs">{(plan.error as Error).message}</p>
        ) : null}
      </div>
    </form>
  );
}
