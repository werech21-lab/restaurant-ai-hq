import { corsHeaders } from "@/lib/site";
import { receiveWhatsAppWebhook } from "@/services/notification.service";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const secret = request.headers.get("x-bridge-secret") ?? "";
  const body = (await request.json().catch(() => null)) as { phone?: unknown; text?: unknown } | null;
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const text = typeof body?.text === "string" ? body.text.slice(0, 2000) : "";
  if (!phone || !text) {
    return Response.json({ ok: false, message: "الهاتف والنص مطلوبان" }, { status: 400, headers });
  }
  const result = await receiveWhatsAppWebhook(secret, phone, text);
  return Response.json(result, { status: result.ok ? 200 : 400, headers });
}
