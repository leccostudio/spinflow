import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import { apiRoutes } from "./routes.js";
import { authRoutes } from "./authRoutes.js";
import { isValidSession, SESSION_COOKIE } from "../auth/session.js";

const WEB_DIST = path.join(process.cwd(), "web", "dist");
const MEDIA_DIR = path.join(process.cwd(), "data", "media");

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);

  await app.register(
    async (api) => {
      await api.register(authRoutes); // /api/auth/* — sem exigir sessão

      api.addHook("onRequest", async (request, reply) => {
        if (request.raw.url?.startsWith("/api/auth")) return;
        const token = request.cookies?.[SESSION_COOKIE];
        if (!(await isValidSession(token))) {
          reply.code(401).send({ error: "Não autenticado." });
        }
      });

      await api.register(apiRoutes);
    },
    { prefix: "/api" }
  );

  // Imagens capturadas (data/media/*.jpg), servidas pro painel exibir.
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: MEDIA_DIR,
    prefix: "/media/",
    decorateReply: false,
  });

  // Painel web (build do Vite). Se ainda não foi buildado, so a API funciona.
  const hasWebBuild = fs.existsSync(path.join(WEB_DIST, "index.html"));
  if (hasWebBuild) {
    await app.register(fastifyStatic, {
      root: WEB_DIST,
      prefix: "/",
      decorateReply: true,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith("/api") || request.raw.url?.startsWith("/media")) {
        return reply.code(404).send({ error: "Rota não encontrada." });
      }
      return reply.sendFile("index.html");
    });
  } else {
    app.get("/", async () => ({
      message: "SpinFlow API rodando. Painel web ainda não buildado (rode `npm run build` em web/).",
    }));
  }

  return app;
}
