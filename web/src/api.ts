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

export interface WhatsAppAccount {
  id: string;
  name: string;
  phoneNumber: string | null;
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
  accountId: string;
  backupAccountId: string | null;
}

export interface ProductDisplay {
  name: string;
  priceOriginal: number;
  priceDiscounted: number;
  discountPercent: number;
  coupon: string;
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
  favorite: boolean;
  dispatchedAt: string | null;
  nameOverride: string | null;
  priceOriginalOverride: string | null;
  priceDiscountedOverride: string | null;
  couponOverride: string | null;
  sourceGroupId: string;
  sourceGroup?: { name: string };
  capturedAt: string;
  display: ProductDisplay;
}

export interface PlatformSettings {
  shopeeAppId: string;
  shopeeAppSecret: string;
  shopeeSubIds: string;
  amazonAffiliateTag: string;
  mercadoLivreTag: string;
  mercadoLivreCode: string;
}

export interface MonitoringSettings {
  restrictedWords: string;
  allowedWords: string;
  dedupeWindowHours: number;
}

export interface FinancialEntry {
  id: string;
  tipo: "gasto" | "ganho";
  plataforma: string;
  valor: number;
  moeda: string;
  status: string;
  dataEvento: string;
  dataSincronizacao: string | null;
  origem: string;
  referenciaExterna: string | null;
  descricao: string | null;
}

export interface FinancialSummary {
  totalGastos: number;
  ganhosAprovados: number;
  ganhosPendentes: number;
  margem: number;
}

export interface MetaStatus {
  connected: boolean;
  statusConexao: string;
  statusMensagem: string | null;
  segmentoId: string | null;
  appId: string;
  hasToken: boolean;
  ultimaSincronizacao: string | null;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  lookbackDays: number;
}

export interface ShopeeStatus {
  connected: boolean;
  statusConexao: string;
  statusMensagem: string | null;
  appId: string;
  hasSecret: boolean;
  ultimaSincronizacao: string | null;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  lookbackDays: number;
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
  accounts: () => request<WhatsAppAccount[]>("/whatsapp/accounts"),
  createAccount: (name: string) =>
    request<{ message: string }>("/whatsapp/accounts", { method: "POST", body: JSON.stringify({ name }) }),
  accountQr: (id: string) => request<{ qr: string | null }>(`/whatsapp/accounts/${id}/qr`),
  groups: () => request<WhatsAppGroup[]>("/whatsapp/groups"),
  syncGroups: (accountId?: string) =>
    request<{ count: number }>("/whatsapp/groups/sync", { method: "POST", body: JSON.stringify({ accountId }) }),
  updateGroup: (
    id: string,
    body: Partial<
      Pick<WhatsAppGroup, "isMonitoring" | "isSending" | "useOriginalImage" | "isAutomationGroup">
    > & { monitoredMarketplaces?: string[]; backupAccountId?: string | null }
  ) => request<WhatsAppGroup>(`/whatsapp/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  products: (params?: {
    marketplace?: string;
    groupId?: string;
    status?: string;
    search?: string;
    favorite?: string;
    sort?: string;
  }) => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(params ?? {})) if (v) clean[k] = v;
    const qs = new URLSearchParams(clean).toString();
    return request<CapturedProduct[]>(`/products${qs ? `?${qs}` : ""}`);
  },
  updateProduct: (
    id: string,
    body: Partial<
      Pick<CapturedProduct, "favorite" | "nameOverride" | "priceOriginalOverride" | "priceDiscountedOverride" | "couponOverride">
    >
  ) => request<CapturedProduct>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id: string) => request<{ ok: true }>(`/products/${id}`, { method: "DELETE" }),
  reconvertProduct: (id: string) => request<CapturedProduct>(`/products/${id}/reconvert`, { method: "POST" }),
  setProductLinks: (items: { id: string; affiliateUrl: string }[]) =>
    request<{ results: { id: string; ok: boolean; error?: string }[] }>("/products/set-links", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

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

  platformSettings: () => request<PlatformSettings>("/settings/platforms"),
  updatePlatformSettings: (body: Partial<PlatformSettings>) =>
    request<PlatformSettings>("/settings/platforms", { method: "PATCH", body: JSON.stringify(body) }),
  monitoringSettings: () => request<MonitoringSettings>("/settings/monitoring"),
  updateMonitoringSettings: (body: Partial<MonitoringSettings>) =>
    request<MonitoringSettings>("/settings/monitoring", { method: "PATCH", body: JSON.stringify(body) }),

  financeiroEntries: (params?: { from?: string; to?: string; plataforma?: string; tipo?: string; status?: string }) => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(params ?? {})) if (v) clean[k] = v;
    const qs = new URLSearchParams(clean).toString();
    return request<FinancialEntry[]>(`/financeiro/entries${qs ? `?${qs}` : ""}`);
  },
  financeiroSummary: (params?: { from?: string; to?: string; plataforma?: string }) => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(params ?? {})) if (v) clean[k] = v;
    const qs = new URLSearchParams(clean).toString();
    return request<FinancialSummary>(`/financeiro/summary${qs ? `?${qs}` : ""}`);
  },
  createFinanceiro: (body: {
    tipo: string;
    plataforma: string;
    valor: number;
    moeda?: string;
    status?: string;
    dataEvento: string;
    referenciaExterna?: string | null;
    descricao?: string | null;
  }) => request<FinancialEntry>("/financeiro/entries", { method: "POST", body: JSON.stringify(body) }),
  updateFinanceiro: (id: string, body: Partial<{ tipo: string; plataforma: string; valor: number; moeda: string; status: string; dataEvento: string; referenciaExterna: string | null; descricao: string | null }>) =>
    request<FinancialEntry>(`/financeiro/entries/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteFinanceiro: (id: string) => request<{ ok: true }>(`/financeiro/entries/${id}`, { method: "DELETE" }),
  importFinanceiro: (entries: Array<{
    tipo?: string;
    plataforma?: string;
    valor?: number | string;
    status?: string;
    dataEvento?: string;
    descricao?: string | null;
    referenciaExterna?: string | null;
  }>) => request<{ imported: number; skipped: number; errors: Array<{ linha: number; erro: string }> }>(
    "/financeiro/import",
    { method: "POST", body: JSON.stringify({ entries }) }
  ),

  metaStatus: () => request<MetaStatus>("/integrations/meta"),
  connectMeta: (body: {
    appId?: string;
    accessToken?: string;
    adAccountId?: string;
    syncEnabled?: boolean;
    syncIntervalMinutes?: number;
    lookbackDays?: number;
  }) => request<MetaStatus>("/integrations/meta", { method: "POST", body: JSON.stringify(body) }),
  testMeta: () => request<MetaStatus>("/integrations/meta/test", { method: "POST", body: "{}" }),
  syncMeta: () => request<{ imported: number; updated: number; total: number }>("/integrations/meta/sync", { method: "POST", body: "{}" }),
  disconnectMeta: () => request<{ ok: true }>("/integrations/meta", { method: "DELETE" }),

  shopeeStatus: () => request<ShopeeStatus>("/integrations/shopee"),
  connectShopee: (body: {
    appId?: string;
    appSecret?: string;
    syncEnabled?: boolean;
    syncIntervalMinutes?: number;
    lookbackDays?: number;
  }) => request<ShopeeStatus>("/integrations/shopee", { method: "POST", body: JSON.stringify(body) }),
  testShopee: () => request<ShopeeStatus>("/integrations/shopee/test", { method: "POST", body: "{}" }),
  syncShopee: () => request<{ imported: number; updated: number; validated: number; total: number }>("/integrations/shopee/sync", { method: "POST", body: "{}" }),
  disconnectShopee: () => request<{ ok: true }>("/integrations/shopee", { method: "DELETE" }),

  authStatus: () => request<{ authenticated: boolean }>("/auth/status"),
  login: (password: string) =>
    request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
};
