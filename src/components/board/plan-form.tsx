'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Select, TextArea } from '@/components/ui/field';
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
      className={`${cardClass()} mx-6 mt-5 flex flex-col gap-3 p-4`}
      onSubmit={(e) => {
        e.preventDefault();
        if (goal.trim() && agentId) plan.mutate();
      }}
    >
      <TextArea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Describe the sprint goal — the planner agent decomposes it into backlog stories for you to curate."
        aria-label="Sprint goal"
        rows={3}
        className="resize-none"
      />
      <div className="flex items-center gap-2">
        <Select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          aria-label="Planner agent"
          className="w-auto"
        >
          <option value="">Choose a planner agent…</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </Select>
        <Button
          type="submit"
          variant="primary"
          disabled={!goal.trim() || !agentId || plan.isPending}
        >
          {plan.isPending ? 'Planning…' : 'Fill the backlog'}
        </Button>
        {plan.isError ? (
          <p className="text-destructive text-xs">{(plan.error as Error).message}</p>
        ) : null}
      </div>
    </form>
  );
}
