import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Criptografia simetrica (AES-256-GCM) pra segredos guardados no banco
 * (ex: access token da Meta). NUNCA guardamos credencial em texto puro.
 *
 * A chave vem de:
 *   1. process.env.ENCRYPTION_KEY (base64 de 32 bytes), se definida; ou
 *   2. um arquivo local data/.enckey gerado automaticamente na 1a execucao.
 * A pasta data/ e o .env estao no .gitignore, entao a chave nunca vai pro
 * repositorio nem pro banco. Se a chave for perdida, os segredos guardados
 * ficam irrecuperaveis (basta reconectar as integracoes).
 */
const KEY_FILE = "data/.enckey";

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.ENCRYPTION_KEY;
  if (fromEnv) {
    const buf = Buffer.from(fromEnv, "base64");
    if (buf.length !== 32) {
      throw new Error("ENCRYPTION_KEY deve ser 32 bytes em base64.");
    }
    cachedKey = buf;
    return buf;
  }

  if (existsSync(KEY_FILE)) {
    const buf = Buffer.from(readFileSync(KEY_FILE, "utf8").trim(), "base64");
    if (buf.length !== 32) throw new Error("Arquivo de chave inválido em data/.enckey.");
    cachedKey = buf;
    return buf;
  }

  const generated = randomBytes(32);
  mkdirSync(dirname(KEY_FILE), { recursive: true });
  writeFileSync(KEY_FILE, generated.toString("base64"), { encoding: "utf8", mode: 0o600 });
  cachedKey = generated;
  return generated;
}

// Formato do payload: base64( iv[12] || authTag[16] || ciphertext ).
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";
  const key = loadKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
