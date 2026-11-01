export function parseCustom(value?: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const data = JSON.parse(value) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const result: Record<string, string> = {};
    for (const [key, item] of Object.entries(data)) {
      if (typeof item === "string" || typeof item === "number") result[key] = String(item);
    }
    return result;
  } catch {
    return {};
  }
}

export function customSummary(value?: string | null) {
  return Object.entries(parseCustom(value))
    .filter(([, item]) => item.trim())
    .map(([key, item]) => `${key}: ${item}`)
    .join(" · ");
}

export function readCustom(form: FormData) {
  const data: Record<string, string> = {};
  for (const [key, item] of form.entries()) {
    if (key.startsWith("custom__") && typeof item === "string") data[key.slice("custom__".length)] = item;
  }
  return data;
}
