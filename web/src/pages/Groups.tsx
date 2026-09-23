import { Fragment, useEffect, useState } from "react";
import { api, type WhatsAppGroup, type WhatsAppAccount } from "../api";

const MARKETPLACES = ["shopee", "amazon", "mercadolivre"];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  );
}

export default function Groups() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api.groups().then(setGroups).catch((e) => setError(e.message)).finally(() => setLoading(false));
    api.accounts().then(setAccounts).catch(() => {});
  }

  useEffect(load, []);

  async function update(
    id: string,
    body: Partial<
      Pick<WhatsAppGroup, "isMonitoring" | "isSending" | "useOriginalImage" | "isAutomationGroup">
    > & { monitoredMarketplaces?: string[]; backupAccountId?: string | null }
  ) {
    setError("");
    try {
      const updated = await api.updateGroup(id, body);
      setGroups((gs) => gs.map((g) => (g.id === id ? updated : g)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sync() {
    setSyncing(true);
    setError("");
    try {
      await api.syncGroups();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  function toggleMarketplace(group: WhatsAppGroup, mk: string) {
    const current = group.monitoredMarketplaces ? group.monitoredMarketplaces.split(",") : [];
    const next = current.includes(mk) ? current.filter((m) => m !== mk) : [...current, mk];
    update(group.id, { monitoredMarketplaces: next });
  }

  function accountName(id: string) {
    return accounts.find((a) => a.id === id)?.name ?? "?";
  }

  if (loading) return <p className="empty">Carregando...</p>;

  return (
    <div>
      <div className="row">
        <div style={{ flex: 1 }}>
          <h1>Grupos</h1>
          <p className="subtitle">Monitoramento, envio, grupo de automação e conta de backup por grupo</p>
        </div>
        <button className="secondary" onClick={sync} disabled={syncing}>
          {syncing ? "Sincronizando..." : "🔄 Sincronizar"}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Monitorar</th>
              <th>Enviar</th>
              <th>Automação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.id}>
                <tr>
                  <td>
                    <div style={{ fontWeight: 500 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {g.participantsCount} membros · via {accountName(g.accountId)}
                      {g.backupAccountId && ` · backup: ${accountName(g.backupAccountId)}`}
                    </div>
                  </td>
                  <td><Toggle checked={g.isMonitoring} onChange={(v) => update(g.id, { isMonitoring: v })} /></td>
                  <td><Toggle checked={g.isSending} onChange={(v) => update(g.id, { isSending: v })} /></td>
                  <td>
                    <Toggle
                      checked={g.isAutomationGroup}
                      onChange={(v) => update(g.id, { isAutomationGroup: v })}
                    />
                  </td>
                  <td>
                    <button className="secondary" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                      {expanded === g.id ? "Fechar" : "Mais"}
                    </button>
                  </td>
                </tr>
                {expanded === g.id && (
                  <tr>
                    <td colSpan={5} style={{ background: "var(--bg)" }}>
                      <div className="row wrap" style={{ gap: 24 }}>
                        {g.isMonitoring && (
                          <div>
                            <label>Marketplaces monitorados (vazio = todos)</label>
                            <div className="row wrap" style={{ gap: 10 }}>
                              {MARKETPLACES.map((mk) => {
                                const active = (g.monitoredMarketplaces || "").split(",").includes(mk);
                                return (
                                  <label key={mk} className="row" style={{ gap: 4, fontSize: 13 }}>
                                    <input
                                      type="checkbox"
                                      checked={active}
                                      onChange={() => toggleMarketplace(g, mk)}
                                    />
                                    {mk}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {g.isMonitoring && (
                          <div className="row" style={{ gap: 6 }}>
                            <label style={{ marginBottom: 0 }}>Usar imagem do grupo</label>
                            <Toggle
                              checked={g.useOriginalImage}
                              onChange={(v) => update(g.id, { useOriginalImage: v })}
                            />
                          </div>
                        )}
                        <div style={{ minWidth: 220 }}>
                          <label>Conta de backup (failover no envio)</label>
                          <select
                            value={g.backupAccountId ?? ""}
                            onChange={(e) =>
                              update(g.id, { backupAccountId: e.target.value || null })
                            }
                          >
                            <option value="">Nenhuma</option>
                            {accounts
                              .filter((a) => a.id !== g.accountId)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.status === "CONNECTED" ? "conectada" : "offline"})
                                </option>
                              ))}
                          </select>
                          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                            Só funciona se essa conta também for membro deste grupo no WhatsApp.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
