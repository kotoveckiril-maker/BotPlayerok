import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ENC_PREFIX = "enc:v1:";
const KEY_SALT = "botplayerok/settings/v1";

let keyCache: Buffer | null = null;

function dataDir(): string {
  return process.env.DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

/**
 * Ключ шифрования секретов:
 *  1) SETTINGS_SECRET (для продакшена, обязательно сохраняйте его в надёжном месте);
 *  2) иначе — автоматически создаётся файл .data/secret.key (права 600).
 */
function loadKey(): Buffer {
  if (keyCache) return keyCache;

  const envSecret = process.env.SETTINGS_SECRET?.trim();
  if (envSecret) {
    keyCache = crypto.scryptSync(envSecret, KEY_SALT, 32);
    return keyCache;
  }

  const file = path.join(dataDir(), "secret.key");
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (raw) {
      keyCache = Buffer.from(raw, "base64");
      if (keyCache.length === 32) return keyCache;
    }
  } catch {
    /* файла ещё нет */
  }

  const key = crypto.randomBytes(32);
  fs.mkdirSync(dataDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, key.toString("base64"), { mode: 0o600 });
  keyCache = key;
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/** AES-256-GCM. Пустая строка остаётся пустой, уже зашифрованное — не трогаем. */
export function encrypt(plain: string): string {
  if (!plain) return "";
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    ENC_PREFIX.slice(0, -1),
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

/** Расшифровывает секрет; старые незашифрованные значения возвращает как есть. */
export function decrypt(value: string): string {
  if (!value) return "";
  if (!isEncrypted(value)) return value;
  try {
    const [ivB64, tagB64, dataB64] = value.slice(ENC_PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      loadKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Не удалось расшифровать секреты. Убедитесь, что SETTINGS_SECRET или файл .data/secret.key совпадает с тем, который использовался при шифровании.",
    );
  }
}

/* ----------------------------- Сессии (HMAC) ----------------------------- */

export function hmacSign(payload: string): string {
  return crypto.createHmac("sha256", loadKey()).update(payload).digest("base64url");
}

export function hmacVerify(payload: string, signature: string): boolean {
  try {
    const expected = crypto.createHmac("sha256", loadKey()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    return actual.length === expected.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ----------------------------- Пароли (scrypt) ----------------------------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, saltB64, hashB64] = stored.split(":");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: 16384,
      r: 8,
      p: 1,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomPassword(length = 14): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
