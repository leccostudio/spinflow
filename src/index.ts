import "dotenv/config";
import { buildServer } from "./api/server.js";
import { startWhatsApp } from "./whatsapp/baileys.js";
import { seedDefaultTemplate } from "./templates/seed.js";

const PORT = Number(process.env.PORT ?? 3333);

async function main() {
  await seedDefaultTemplate();

  const app = await buildServer();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API rodando em http://localhost:${PORT}`);

  await startWhatsApp();
}

main().catch((err) => {
  console.error("Falha ao iniciar o SpinFlow:", err);
  process.exit(1);
});
