// 撮った写真をブラウザの IndexedDB に保存する。使えない環境では保存せずに動く。

export interface Shot {
  id: number;
  dataUrl: string;
  caption: string;
  detail: string;
}

const DB_NAME = 'camera-drill';
const STORE = 'shots';
export const MAX_SHOTS = 50;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** 新しい順に返す */
export async function loadShots(): Promise<Shot[]> {
  try {
    const shots = await withStore<Shot[]>('readonly', (s) => s.getAll());
    return shots.sort((a, b) => b.id - a.id);
  } catch {
    return [];
  }
}

export async function saveShot(shot: Shot): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.put(shot));
  } catch {
    // 保存できなくても、このページを開いている間は使える
  }
}

export async function deleteShot(id: number): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(id));
  } catch {
    // 同上
  }
}
