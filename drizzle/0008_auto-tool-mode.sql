ALTER TABLE "provider_connections" ALTER COLUMN "tool_mode" SET DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "tool_calling" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
-- 'native' on existing rows was the previous default, never a deliberate
-- choice: the mode shipped one commit ago and the UI offered nothing else.
-- Move them onto 'auto' so attaching a tool works without a settings trip.
UPDATE "provider_connections" SET "tool_mode" = 'auto' WHERE "tool_mode" = 'native';
