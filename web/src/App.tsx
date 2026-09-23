import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutGrid,
  Smartphone,
  Users,
  Package,
  FileText,
  CalendarClock,
  Sliders,
  Search,
  LogOut,
  Bird,
} from "lucide-react";
import { api, type WhatsAppStatus } from "./api";

const sections: Array<{
  label: string;
  links: Array<{ to: string; label: string; icon: React.ReactNode; end?: boolean }>;
}> = [
  {
    label: "Essencial",
    links: [
      { to: "/", label: "Visão Geral", icon: <LayoutGrid size={16} />, end: true },
      { to: "/contas", label: "Contas WhatsApp", icon: <Smartphone size={16} /> },
      { to: "/grupos", label: "Grupos", icon: <Users size={16} /> },
      { to: "/produtos", label: "Produtos", icon: <Package size={16} /> },
      { to: "/templates", label: "Templates", icon: <FileText size={16} /> },
      { to: "/agendamentos", label: "Agendamentos", icon: <CalendarClock size={16} /> },
    ],
  },
  {
    label: "Automação",
    links: [{ to: "/configuracoes", label: "Disparo Automático", icon: <Sliders size={16} /> }],
  },
];

const statusDot: Record<string, string> = {
  CONNECTED: "green",
  CONNECTING: "yellow",
  DISCONNECTED: "red",
};
const statusText: Record<string, string> = {
  CONNECTED: "Conectado",
  CONNECTING: "Conectando",
  DISCONNECTED: "Desconectado",
};

export default function App({ onLogout }: { onLogout: () => void }) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [quickLink, setQuickLink] = useState("");
  const [quickResult, setQuickResult] = useState("");

  useEffect(() => {
    api.whatsappStatus().then(setStatus).catch(() => {});
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  async function handleQuickLink(e: React.FormEvent) {
    e.preventDefault();
    if (!quickLink.trim()) return;
    setQuickResult("Convertendo...");
    try {
      const result = await api.convertLink(quickLink.trim());
      setQuickResult(`✅ ${result.affiliateUrl}`);
    } catch (err) {
      setQuickResult(`❌ ${(err as Error).message}`);
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Bird size={16} /></span>
          SpinFlow
        </div>
        <nav>
          {sections.map((section) => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                >
                  {l.icon}
                  {l.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <button className="secondary" onClick={logout}>
          <LogOut size={15} /> Sair
        </button>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
            <form className="quick-input" onSubmit={handleQuickLink} style={{ maxWidth: "none" }}>
              <Search size={15} />
              <input
                type="text"
                placeholder="Colar link de produto pra converter rapidinho..."
                value={quickLink}
                onChange={(e) => setQuickLink(e.target.value)}
                onBlur={() => setTimeout(() => setQuickResult(""), 4000)}
              />
            </form>
            {quickResult && (
              <div
                className="card"
                style={{
                  position: "absolute",
                  top: 40,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  fontSize: 12,
                  wordBreak: "break-all",
                  padding: "8px 12px",
                  margin: 0,
                }}
              >
                {quickResult}
              </div>
            )}
          </div>
          <div className="spacer" />
          {status && (
            <div className="status-pill">
              <span className={`status-dot ${statusDot[status.status] ?? "red"}`} />
              {statusText[status.status] ?? status.status}
            </div>
          )}
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
