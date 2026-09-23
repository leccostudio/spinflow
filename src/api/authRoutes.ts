import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import {
  checkPassword,
  createSession,
  destroySession,
  isValidSession,
  SESSION_COOKIE,
} from "../auth/session.js";

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { password?: string } }>("/auth/login", async (request, reply) => {
    if (!env.authPassword) {
      return reply
        .code(500)
        .send({ error: "AUTH_PASSWORD não configurada no servidor — defina no .env." });
    }

    const { password } = request.body ?? {};
    if (!password || !checkPassword(password, env.authPassword)) {
      return reply.code(401).send({ error: "Senha incorreta." });
    }

    const token = await createSession();
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { ok: true };
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/status", async (request) => {
    const token = request.cookies?.[SESSION_COOKIE];
    return { authenticated: await isValidSession(token) };
  });
}
