// CANONICAL — single source of truth lives here. Do not duplicate.

// Device identity persistent store.
// Private key: non-extractable CryptoKey in IndexedDB (never leaves crypto subsystem).
// Device ID: SHA-256 hex in localStorage (public, fast lookup).

import {
  generateDeviceKeypair,
  exportPublicKeyRaw,
  deriveDeviceId,
  base64UrlEncode,
} from "./device-crypto.js";

const IDB_NAME = "gateway-device-identity";
const IDB_STORE = "keys";
const IDB_KEY = "current";
const LS_KEY = "gateway-device-id";

export type DeviceIdentity = {
  deviceId: string;
  privateKey: CryptoKey;
  publicKeyBase64Url: string;
};

type StoredEntry = {
  deviceId: string;
  publicKeyRaw: string;
  keyPair: CryptoKeyPair;
  createdAtMs: number;
};

// --- SubtleCrypto + IndexedDB availability ---

export function isDeviceIdentitySupported(): boolean {
  try {
    return (
      typeof globalThis.crypto?.subtle?.generateKey === "function" &&
      typeof globalThis.indexedDB?.open === "function"
    );
  } catch {
    return false;
  }
}

// --- IndexedDB helpers ---

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<StoredEntry | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const request = store.get(key);
    request.addEventListener("success", () => resolve(request.result as StoredEntry | undefined));
    request.addEventListener("error", () => reject(request.error));
  });
}

function idbPut(db: IDBDatabase, key: string, value: StoredEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const request = store.put(value, key);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

// --- Load or Create ---

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity | null> {
  if (!isDeviceIdentitySupported()) {
    return null;
  }

  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }

  try {
    // Try loading existing identity
    const existing = await idbGet(db, IDB_KEY);
    if (
      existing &&
      typeof existing.deviceId === "string" &&
      typeof existing.publicKeyRaw === "string" &&
      existing.keyPair?.privateKey instanceof CryptoKey
    ) {
      return {
        deviceId: existing.deviceId,
        privateKey: existing.keyPair.privateKey,
        publicKeyBase64Url: existing.publicKeyRaw,
      };
    }
  } catch {
    // Corrupt entry — fall through to regenerate
  }

  // Generate new identity
  try {
    const keyPair = await generateDeviceKeypair();
    const publicKeyRaw = await exportPublicKeyRaw(keyPair.publicKey);
    const deviceId = await deriveDeviceId(publicKeyRaw);
    const publicKeyBase64Url = base64UrlEncode(publicKeyRaw);

    const entry: StoredEntry = {
      deviceId,
      publicKeyRaw: publicKeyBase64Url,
      keyPair,
      createdAtMs: Date.now(),
    };

    await idbPut(db, IDB_KEY, entry);

    // Device ID in localStorage for quick existence check
    try {
      localStorage.setItem(LS_KEY, deviceId);
    } catch {
      // localStorage blocked — non-fatal
    }

    return {
      deviceId,
      privateKey: keyPair.privateKey,
      publicKeyBase64Url,
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}
