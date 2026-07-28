import { z } from 'zod';

export const createThreadSchema = z.object({
  agentId: z.uuid(),
  title: z.string().min(1).max(200),
});

export const postMessageSchema = z.object({
  text: z.string().min(1).max(20_000),
});
