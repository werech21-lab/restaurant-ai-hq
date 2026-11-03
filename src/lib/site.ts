export const ERP_ORIGIN = "https://erp.aetherbi.com";
export const MARKETING_ORIGIN = "https://aetherbi.com";

export const ALLOWED_ORIGINS = [MARKETING_ORIGIN, "https://aetherbi.com", "https://www.aetherbi.com", ERP_ORIGIN];

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : MARKETING_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-bridge-secret",
    Vary: "Origin",
  };
}
