import { Fragment, useEffect, useState } from "react";
import { api, type WhatsAppGroup } from "../api";

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
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api.groups().then(setGroups).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function update(
    id: string,
    body: Partial<Pick<WhatsAppGroup, "isMonitoring" | "isSending" | "useOriginalImage" | "isAutomationGroup">> & {
      monitoredMarketplaces?: string[];
    }
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

  if (loading) return <p className="empty">Carregando...</p>;

  return (
    <div>
      <div className="row">
        <div style={{ flex: 1 }}>
          <h1>Grupos</h1>
          <p className="subtitle">Monitoramento, envio e o grupo de automação (comandos)</p>
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
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{g.participantsCount} membros</div>
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
                    {g.isMonitoring && (
                      <button className="secondary" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                        {expanded === g.id ? "Fechar" : "Filtros"}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === g.id && (
                  <tr>
                    <td colSpan={5} style={{ background: "var(--bg)" }}>
                      <div className="row wrap" style={{ gap: 16 }}>
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
                        <div className="row" style={{ gap: 6 }}>
                          <label style={{ marginBottom: 0 }}>Usar imagem do grupo</label>
                          <Toggle
                            checked={g.useOriginalImage}
                            onChange={(v) => update(g.id, { useOriginalImage: v })}
                          />
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
