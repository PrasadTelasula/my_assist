import { probeConnection } from '@/server/providers';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return Response.json(await probeConnection(id));
}
