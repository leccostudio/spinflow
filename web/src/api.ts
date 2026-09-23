const BASE = "/api";

export class UnauthorizedError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json().catch(() => undefined);
  // /auth/login usa 401 pra "senha incorreta" - deixa a mensagem real passar.
  if (res.status === 401 && path !== "/auth/login") {
    throw new UnauthorizedError("Não autenticado.");
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Erro ${res.status}`);
  }
  return data as T;
}

export interface WhatsAppStatus {
  id?: string;
  name?: string;
  phoneNumber?: string | null;
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
}

export interface WhatsAppGroup {
  id: string;
  jid: string;
  name: string;
  isMonitoring: boolean;
  isSending: boolean;
  monitoredMarketplaces: string;
  useOriginalImage: boolean;
  isAutomationGroup: boolean;
  participantsCount: number;
}

export interface CapturedProduct {
  id: string;
  sourceUrl: string;
  marketplace: string;
  affiliateUrl: string | null;
  status: string;
  conversionError: string | null;
  messageText: string | null;
  imagePath: string | null;
  priority: boolean;
  dispatchedAt: string | null;
  sourceGroupId: string;
  sourceGroup?: { name: string };
  capturedAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  marketplace: string;
  content: string;
  isActive: boolean;
}

export interface ScheduledMessage {
  id: string;
  groupIds: string;
  text: string | null;
  productId: string | null;
  templateId: string | null;
  scheduledAt: string;
  status: string;
  error: string | null;
}

export interface AutoDispatchSettings {
  id: string;
  enabled: boolean;
  startHour: number;
  endHour: number;
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  minProductsPerRun: number;
  maxProductsPerRun: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export const api = {
  whatsappStatus: () => request<WhatsAppStatus>("/whatsapp/status"),
  groups: () => request<WhatsAppGroup[]>("/whatsapp/groups"),
  syncGroups: () => request<{ count: number }>("/whatsapp/groups/sync", { method: "POST" }),
  updateGroup: (
    id: string,
    body: Partial<Pick<WhatsAppGroup, "isMonitoring" | "isSending" | "useOriginalImage" | "isAutomationGroup">> & {
      monitoredMarketplaces?: string[];
    }
  ) => request<WhatsAppGroup>(`/whatsapp/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  products: (params?: { marketplace?: string; groupId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<CapturedProduct[]>(`/products${qs ? `?${qs}` : ""}`);
  },

  convertLink: (url: string) => request<{ affiliateUrl: string; marketplace: string; method: string }>("/links/convert", { method: "POST", body: JSON.stringify({ url }) }),

  templates: () => request<MessageTemplate[]>("/templates"),
  createTemplate: (body: { name: string; marketplace?: string; content: string }) =>
    request<MessageTemplate>("/templates", { method: "POST", body: JSON.stringify(body) }),
  updateTemplate: (id: string, body: Partial<MessageTemplate>) =>
    request<MessageTemplate>(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTemplate: (id: string) => request<{ ok: true }>(`/templates/${id}`, { method: "DELETE" }),
  previewTemplate: (id: string, productId: string) =>
    request<{ text: string; templateName: string }>(`/templates/${id}/preview`, {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),

  sendMessage: (body: { groupIds: string[]; text?: string; productId?: string; templateId?: string }) =>
    request<{ text: string; results: Array<{ groupName: string; success: boolean; error?: string }> }>(
      "/messages/send",
      { method: "POST", body: JSON.stringify(body) }
    ),

  scheduledMessages: (status?: string) =>
    request<ScheduledMessage[]>(`/messages/scheduled${status ? `?status=${status}` : ""}`),
  createScheduled: (body: { groupIds: string[]; scheduledAt: string; text?: string; productId?: string; templateId?: string }) =>
    request<ScheduledMessage>("/messages/scheduled", { method: "POST", body: JSON.stringify(body) }),
  cancelScheduled: (id: string) => request<ScheduledMessage>(`/messages/scheduled/${id}`, { method: "DELETE" }),

  autoDispatch: () => request<AutoDispatchSettings>("/auto-dispatch"),
  updateAutoDispatch: (body: Partial<AutoDispatchSettings>) =>
    request<AutoDispatchSettings>("/auto-dispatch", { method: "PATCH", body: JSON.stringify(body) }),

  authStatus: () => request<{ authenticated: boolean }>("/auth/status"),
  login: (password: string) =>
    request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
};
