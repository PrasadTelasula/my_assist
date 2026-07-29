-- Collapse duplicate agent names created before this constraint existed
-- (re-running the seed inserted a fresh row each time). References are
-- repointed to the oldest row per name, then the extras are dropped.
CREATE TEMP TABLE agent_dedupe AS
SELECT
  id AS dup_id,
  first_value(id) OVER (PARTITION BY name ORDER BY created_at, id) AS keep_id
FROM agents;
--> statement-breakpoint
UPDATE threads t SET agent_id = d.keep_id
FROM agent_dedupe d WHERE t.agent_id = d.dup_id AND d.dup_id <> d.keep_id;
--> statement-breakpoint
UPDATE runs r SET agent_id = d.keep_id
FROM agent_dedupe d WHERE r.agent_id = d.dup_id AND d.dup_id <> d.keep_id;
--> statement-breakpoint
UPDATE sprints s SET critic_agent_id = d.keep_id
FROM agent_dedupe d WHERE s.critic_agent_id = d.dup_id AND d.dup_id <> d.keep_id;
--> statement-breakpoint
UPDATE tasks t SET assignee_agent_id = d.keep_id
FROM agent_dedupe d WHERE t.assignee_agent_id = d.dup_id AND d.dup_id <> d.keep_id;
--> statement-breakpoint
UPDATE task_activity a SET actor_agent_id = d.keep_id
FROM agent_dedupe d WHERE a.actor_agent_id = d.dup_id AND d.dup_id <> d.keep_id;
--> statement-breakpoint
-- Tool attachments of the discarded duplicates are dropped, not merged: the
-- unique (agent_id, tool_id) index would collide on repoint.
DELETE FROM agent_tools t USING agent_dedupe d
WHERE t.agent_id = d.dup_id AND d.dup_id <> d.keep_id;
--> statement-breakpoint
DELETE FROM agents a USING agent_dedupe d
WHERE a.id = d.dup_id AND d.dup_id <> d.keep_id;
--> statement-breakpoint
DROP TABLE agent_dedupe;
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_name_unique" UNIQUE("name");
