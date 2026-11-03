import { prisma } from "@/lib/db";
import { cleanEmail, cleanText } from "@/lib/documents";
import { corsHeaders } from "@/lib/site";
import { notifyWebsiteLead } from "@/services/notification.service";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const body = (await request.json().catch(() => null)) as {
    contactName?: unknown;
    phone?: unknown;
    email?: unknown;
    title?: unknown;
    message?: unknown;
  } | null;
  const contactName = cleanText(body?.contactName, 80);
  const phone = cleanText(body?.phone, 30);
  const email = cleanEmail(body?.email);
  const title = cleanText(body?.title, 120) || "طلب نسخة تجريبية من aetherbi.com";
  const message = cleanText(body?.message, 400);
  if (contactName.length < 2 || phone.length < 6) {
    return Response.json({ ok: false, message: "الاسم والهاتف مطلوبان" }, { status: 400, headers });
  }
  await prisma.lead.create({
    data: {
      title,
      contactName,
      phone,
      email,
      stage: "NEW",
      source: "aetherbi.com",
      notes: message || "وارد من نموذج aetherbi.com",
    },
  });
  await notifyWebsiteLead({ name: contactName, phone, title }).catch(() => undefined);
  return Response.json({ ok: true, message: "تم استلام الطلب" }, { headers });
}
