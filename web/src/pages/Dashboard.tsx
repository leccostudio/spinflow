import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Smartphone, CalendarClock, Zap } from "lucide-react";
import {
  api,
  type WhatsAppStatus,
  type CapturedProduct,
  type AutoDispatchSettings,
  type ScheduledMessage,
  type WhatsAppAccount,
} from "../api";

const statusLabel: Record<string, { text: string; cls: string }> = {
  CONNECTED: { text: "Conectado", cls: "green" },
  CONNECTING: { text: "Conectando...", cls: "yellow" },
  DISCONNECTED: { text: "Desconectado", cls: "red" },
};

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 480;
  const height = 150;
  const barGap = 10;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} width="100%" role="img" aria-label="Produtos capturados por dia">
      <line x1={0} y1={height} x2={width} y2={height} stroke="#e1e0d9" strokeWidth={1} />
      {data.map((d, i) => {
        const barHeight = (d.value / max) * (height - 20);
        const x = i * (barWidth + barGap);
        const y = height - barHeight;
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.value} produto(s)`}</title>
            {d.value > 0 && (
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#52514e">
                {d.value}
              </text>
            )}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              rx={4}
              fill="#16a34a"
            />
            <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fontSize={11} fill="#898781">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const size = 140;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="row" style={{ gap: 20, alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Status das contas">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total === 0 ? (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e1e0d9" strokeWidth={stroke} />
          ) : (
            segments
              .filter((s) => s.value > 0)
              .map((seg) => {
                const fraction = seg.value / total;
                const dash = fraction * circumference;
                const gap = circumference - dash;
                const circle = (
                  <circle
                    key={seg.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${Math.max(dash - 2, 0)} ${gap + 2}`}
                    strokeDashoffset={-offset}
                  >
                    <title>{`${seg.label}: ${seg.value}`}</title>
                  </circle>
                );
                offset += dash;
                return circle;
              })
          )}
        </g>
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={20} fontWeight={700} fill="#0b0b0b">
          {total}
        </text>
      </svg>
      <div className="chart-legend">
        {segments.map((seg) => (
          <div className="chart-legend-item" key={seg.label}>
            <span className="chart-legend-dot" style={{ background: seg.color }} />
            {seg.label} <span style={{ color: "#898781" }}>({seg.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [products, setProducts] = useState<CapturedProduct[]>([]);
  const [autoDispatch, setAutoDispatch] = useState<AutoDispatchSettings | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);

  useEffect(() => {
    api.whatsappStatus().then(setStatus).catch(() => {});
    api.products().then(setProducts).catch(() => {});
    api.autoDispatch().then(setAutoDispatch).catch(() => {});
    api.scheduledMessages("PENDING").then(setScheduled).catch(() => {});
    api.accounts().then(setAccounts).catch(() => {});
  }, []);

  const pendingCount = products.filter((p) => !p.dispatchedAt).length;

  const captureByDay = useMemo(() => {
    const days: Array<{ label: string; value: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const value = products.filter((p) => p.capturedAt.slice(0, 10) === key).length;
      days.push({ label, value });
    }
    return days;
  }, [products]);

  const accountSegments = useMemo(
    () => [
      { label: "Conectadas", value: accounts.filter((a) => a.status === "CONNECTED").length, color: "#0ca30c" },
      { label: "Conectando", value: accounts.filter((a) => a.status === "CONNECTING").length, color: "#fab219" },
      { label: "Desconectadas", value: accounts.filter((a) => a.status === "DISCONNECTED").length, color: "#d03b3b" },
    ],
    [accounts]
  );

  const badge = status ? statusLabel[status.status] : undefined;

  return (
    <div>
      <h1>Visão Geral</h1>
      <p className="subtitle">Status geral do SpinFlow</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Smartphone size={17} /></div>
          <div className="row" style={{ gap: 6 }}>
            {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
          </div>
          <div className="stat-label" style={{ marginTop: 6 }}>
            {status?.phoneNumber ? `+${status.phoneNumber}` : "WhatsApp"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><MessageSquare size={17} /></div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-label">Produtos capturados</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Zap size={17} /></div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Aguardando envio</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gray"><CalendarClock size={17} /></div>
          <div className="stat-value">{scheduled.length}</div>
          <div className="stat-label">Agendamentos pendentes</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Zap size={17} /></div>
          <div className="row">
            <span className={`badge ${autoDispatch?.enabled ? "green" : "gray"}`}>
              {autoDispatch?.enabled ? "Ativado" : "Desativado"}
            </span>
          </div>
          <div className="stat-label" style={{ marginTop: 6 }}>Disparo automático</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <h2>Produtos capturados — últimos 7 dias</h2>
          <BarChart data={captureByDay} />
        </div>
        <div className="card">
          <h2>Status das contas WhatsApp</h2>
          <Donut segments={accountSegments} />
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
