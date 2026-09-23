import { Link } from "react-router-dom";
import { Zap, MessageSquare, Globe, FileText, ShoppingBag, Eye, SlidersHorizontal } from "lucide-react";

const cards = [
  {
    to: "/configuracoes/disparo-automatico",
    icon: <Zap size={20} />,
    title: "Disparo Automático",
    desc: "Configure o disparo automático",
  },
  {
    to: "/configuracoes/grupo-automacao",
    icon: <MessageSquare size={20} />,
    title: "Grupo de Automação",
    desc: "Configure um grupo para comandos rápidos",
  },
  {
    to: "/configuracoes/site",
    icon: <Globe size={20} />,
    title: "Site",
    desc: "Personalize seu site",
  },
  {
    to: "/templates",
    icon: <FileText size={20} />,
    title: "Templates",
    desc: "Gerencie templates de mensagem",
  },
  {
    to: "/configuracoes/plataformas",
    icon: <ShoppingBag size={20} />,
    title: "Plataformas",
    desc: "Integrações com Marketplaces",
  },
  {
    to: "/configuracoes/monitoramento",
    icon: <Eye size={20} />,
    title: "Monitoramento Automático",
    desc: "Configure o monitoramento automático",
  },
  {
    to: "/configuracoes/avancado",
    icon: <SlidersHorizontal size={20} />,
    title: "Configurações Avançadas",
    desc: "Gerencie filtros avançados",
  },
];

export default function SettingsHub() {
  return (
    <div>
      <h1>Configurações</h1>
      <p className="subtitle">Tudo que controla como o SpinFlow opera</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div className="stat-icon green">{c.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{c.title}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
