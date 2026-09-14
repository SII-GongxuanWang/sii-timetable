import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, pbkdf2Sync, createCipheriv } from "node:crypto";
import {
  SESSION_DURATION,
  sessionIsValid,
  importPassword,
  decryptSchedule,
} from "./session.js";

function fixture(password, data) {
  const salt = randomBytes(16),
    iv = randomBytes(12),
    iterations = 1000;
  const key = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data)),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    iterations,
    ciphertext: ciphertext.toString("base64"),
  };
}

test("不可导出的设备密钥可被结构化克隆并解锁重新加密的数据", async () => {
  const material = structuredClone(
    await importPassword("test-device-password"),
  );
  assert.equal(material.extractable, false);
  await assert.rejects(crypto.subtle.exportKey("raw", material));
  for (const revision of [1, 2]) {
    const data = { revision, sessions: [] };
    assert.deepEqual(
      await decryptSchedule(fixture("test-device-password", data), material),
      data,
    );
  }
});

test("设备密钥不能解锁已经更换口令的数据", async () => {
  const material = await importPassword("old-password");
  await assert.rejects(decryptSchedule(fixture("new-password", {}), material));
});

test("会话在30天到期边界失效，且拒绝无效密钥", async () => {
  const now = Date.now();
  const session = {
    version: 1,
    material: await importPassword("test"),
    expiresAt: now + SESSION_DURATION,
  };
  assert.equal(sessionIsValid(session, now), true);
  assert.equal(sessionIsValid(session, session.expiresAt - 1), true);
  assert.equal(sessionIsValid(session, session.expiresAt), false);
  assert.equal(sessionIsValid({ ...session, material: {} }, now), false);
  assert.equal(sessionIsValid({ ...session, expiresAt: Infinity }, now), false);
});
