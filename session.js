const databaseName = "sii-timetable-session-v1";
const storeName = "sessions";
const sessionId = "remembered-device";
export const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("无法访问此设备的存储"));
  });
}

async function transaction(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error("设备存储操作失败"));
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function sessionIsValid(session, now = Date.now()) {
  return Boolean(
    session &&
    session.version === 1 &&
    Number.isFinite(session.expiresAt) &&
    session.expiresAt > now &&
    session.expiresAt <= now + SESSION_DURATION &&
    session.material instanceof CryptoKey &&
    !session.material.extractable &&
    session.material.algorithm.name === "PBKDF2" &&
    session.material.usages.includes("deriveKey"),
  );
}

export async function loadSession() {
  const session = await transaction("readonly", (store) =>
    store.get(sessionId),
  );
  if (session && !sessionIsValid(session)) {
    await clearSession();
    return undefined;
  }
  return session;
}

export async function saveSession(material) {
  const session = {
    version: 1,
    material,
    expiresAt: Date.now() + SESSION_DURATION,
  };
  if (!sessionIsValid(session)) throw new Error("无法记住此设备");
  await transaction("readwrite", (store) => store.put(session, sessionId));
  return session;
}

export function clearSession() {
  return transaction("readwrite", (store) => store.delete(sessionId));
}

export function importPassword(password) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
}

const base64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

export async function decryptSchedule(envelope, material) {
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64(envelope.salt),
      iterations: envelope.iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64(envelope.iv) },
    key,
    base64(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
