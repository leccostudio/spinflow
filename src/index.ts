import "dotenv/config";
import { buildServer } from "./api/server.js";
import { startAllAccounts } from "./whatsapp/baileys.js";
import { seedDefaultTemplate } from "./templates/seed.js";
import { startScheduledMessageLoop } from "./scheduler/scheduled.js";
import { startAutoDispatchLoop } from "./scheduler/autoDispatch.js";
import { startMetaSyncLoop } from "./integrations/metaService.js";
import { startShopeeSyncLoop } from "./integrations/shopeeService.js";

const PORT = Number(process.env.PORT ?? 3333);

async function main() {
  await seedDefaultTemplate();

  const app = await buildServer();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API rodando em http://localhost:${PORT}`);

  await startAllAccounts();

  startScheduledMessageLoop();
  startAutoDispatchLoop(); // no-op enquanto AutoDispatchSettings.enabled = false (padrão)
  startMetaSyncLoop(); // no-op enquanto a integração Meta não estiver conectada + syncEnabled
  startShopeeSyncLoop(); // no-op enquanto a integração Shopee não estiver conectada + syncEnabled
  console.log("Loops de agendamento, disparo automático e sync Meta/Shopee iniciados.");
}

main().catch((err) => {
  console.error("Falha ao iniciar o SpinFlow:", err);
  process.exit(1);
});
