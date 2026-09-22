import type { WASocket } from "@whiskeysockets/baileys";
import { prisma } from "../db/client.js";

export async function syncGroups(accountId: string, sock: WASocket): Promise<{ count: number }> {
  const groups = await sock.groupFetchAllParticipating();
  const entries = Object.values(groups);

  for (const group of entries) {
    await prisma.whatsAppGroup.upsert({
      where: { jid: group.id },
      create: {
        jid: group.id,
        name: group.subject ?? group.id,
        participantsCount: group.participants?.length ?? 0,
        accountId,
      },
      update: {
        name: group.subject ?? group.id,
        participantsCount: group.participants?.length ?? 0,
        lastSyncedAt: new Date(),
      },
    });
  }

  console.log(`Sincronizados ${entries.length} grupos do WhatsApp.`);
  return { count: entries.length };
}
