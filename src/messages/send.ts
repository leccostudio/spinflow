import { prisma } from "../db/client.js";
import { getSocket } from "../whatsapp/baileys.js";

export interface SendResult {
  groupId: string;
  groupName: string;
  jid: string;
  success: boolean;
  error?: string;
}

export async function sendTextToGroups(groupIds: string[], text: string): Promise<SendResult[]> {
  const groups = await prisma.whatsAppGroup.findMany({ where: { id: { in: groupIds } } });
  const sock = getSocket();

  const results: SendResult[] = [];
  for (const group of groups) {
    try {
      await sock.sendMessage(group.jid, { text });
      results.push({ groupId: group.id, groupName: group.name, jid: group.jid, success: true });
    } catch (err) {
      results.push({
        groupId: group.id,
        groupName: group.name,
        jid: group.jid,
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    }
  }
  return results;
}
