export type ActionResult = { ok: true; message?: string; id?: string; token?: string } | { ok: false; message: string };

export function ok(message?: string): ActionResult {
  return { ok: true, message };
}

export function fail(message: string): ActionResult {
  return { ok: false, message };
}

export type SearchHit = {
  id: string;
  label: string;
  meta?: string;
  costPrice?: number;
  sellingPrice?: number;
  stock?: number;
};

export type LineInput = {
  productId: string;
  quantity: number;
  price: number;
};

export type DocumentInput = {
  partyId: string;
  paidAmount: number;
  discount?: number;
  items: LineInput[];
  paymentMethod?: "CASH" | "CARD" | "CREDIT" | "MIXED";
  warehouseId?: string;
  customData?: Record<string, string>;
  source?: "pos" | "sales";
};

export type PartyInput = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  customData?: Record<string, string>;
};
