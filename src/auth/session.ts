import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../db/client.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
export const SESSION_COOKIE = "sf_session";

export function checkPassword(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { token, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  return token;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session) return false;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return false;
  }
  return true;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}
