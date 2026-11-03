import { prisma } from "@/lib/db";
import { cleanText } from "@/lib/documents";
import { corsHeaders } from "@/lib/site";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
  const path = cleanText(body?.path, 160) || "/";
  await prisma.siteVisit.create({ data: { source: "aetherbi.com", path } });
  return Response.json({ ok: true }, { headers });
}
