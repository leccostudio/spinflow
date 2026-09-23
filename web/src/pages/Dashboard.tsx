import { useEffect, useState } from "react";
import { api, type WhatsAppStatus, type CapturedProduct, type AutoDispatchSettings, type ScheduledMessage } from "../api";

const statusLabel: Record<string, { text: string; cls: string }> = {
  CONNECTED: { text: "Conectado", cls: "green" },
  CONNECTING: { text: "Conectando...", cls: "yellow" },
  DISCONNECTED: { text: "Desconectado", cls: "red" },
};

export default function Dashboard() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [products, setProducts] = useState<CapturedProduct[]>([]);
  const [autoDispatch, setAutoDispatch] = useState<AutoDispatchSettings | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);

  useEffect(() => {
    api.whatsappStatus().then(setStatus).catch(() => {});
    api.products().then(setProducts).catch(() => {});
    api.autoDispatch().then(setAutoDispatch).catch(() => {});
    api.scheduledMessages("PENDING").then(setScheduled).catch(() => {});
  }, []);

  const pendingCount = products.filter((p) => !p.dispatchedAt).length;
  const badge = status ? statusLabel[status.status] : undefined;

  return (
    <div>
      <h1>Visão Geral</h1>
      <p className="subtitle">Status geral do SpinFlow</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">WhatsApp</div>
          <div className="row">
            {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
          </div>
          {status?.phoneNumber && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>+{status.phoneNumber}</div>}
        </div>
        <div className="stat-card">
          <div className="stat-value">{products.length}</div>
          <div className="stat-label">Produtos capturados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Aguardando envio</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{scheduled.length}</div>
          <div className="stat-label">Agendamentos pendentes</div>
        </div>
        <div className="stat-card">
          <div className="row">
            <span className={`badge ${autoDispatch?.enabled ? "green" : "gray"}`}>
              {autoDispatch?.enabled ? "Ativado" : "Desativado"}
            </span>
          </div>
          <div className="stat-label" style={{ marginTop: 6 }}>Disparo automático</div>
        </div>
      </div>

      <div className="card">
        <h2>Últimos produtos capturados</h2>
        {products.length === 0 && <div className="empty">Nenhum produto capturado ainda.</div>}
        {products.slice(0, 8).map((p) => (
          <div key={p.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            {p.imagePath ? (
              <img className="thumb" src={`/media/${p.imagePath.split(/[\\/]/).pop()}`} alt="" />
            ) : (
              <div className="thumb" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.messageText?.split("\n")[0]?.replace(/\*/g, "") || p.sourceUrl}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{p.sourceGroup?.name}</div>
            </div>
            <span className="badge gray">{p.marketplace}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
