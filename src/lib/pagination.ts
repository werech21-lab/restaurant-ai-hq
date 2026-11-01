export const PAGE_SIZE = 20;

export type RawQuery = {
  q?: string | string[];
  page?: string | string[];
  tab?: string | string[];
  filter?: string | string[];
  status?: string | string[];
  doc?: string | string[];
  role?: string | string[];
};

function first(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export async function readQuery(input: Promise<RawQuery> | RawQuery) {
  const raw = await input;
  const pageNumber = Number(first(raw.page));
  return {
    q: first(raw.q).trim(),
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1,
    tab: first(raw.tab),
    filter: first(raw.filter),
    status: first(raw.status),
    doc: first(raw.doc),
    role: first(raw.role),
  };
}

export function pageHref(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function likeContains(value: string) {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
