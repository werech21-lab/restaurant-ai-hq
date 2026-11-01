import { applyWebhook } from "@/services/payment-gateway.service";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-erp-signature") ?? "";
  const result = await applyWebhook(raw, signature);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
