export type OfflineSale = {
  id: string;
  partyId: string;
  paidAmount: number;
  paymentMethod: "CASH" | "CARD" | "CREDIT";
  items: Array<{ productId: string; quantity: number; price: number }>;
  createdAt: string;
};

const DB_NAME = "aetherbi-pos";
const STORE = "queue";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueSale(sale: OfflineSale) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
  const sync = registration ? (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync : undefined;
  if (sync) await sync.register("pos-sync").catch(() => undefined);
}

export async function listQueued() {
  const db = await openDb();
  const rows = await new Promise<OfflineSale[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as OfflineSale[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueued(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
