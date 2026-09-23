import { NavLink, Outlet } from "react-router-dom";
import { api } from "./api";

const links = [
  { to: "/", label: "Visão Geral", end: true },
  { to: "/grupos", label: "Grupos" },
  { to: "/produtos", label: "Produtos" },
  { to: "/templates", label: "Templates" },
  { to: "/agendamentos", label: "Agendamentos" },
  { to: "/configuracoes", label: "Disparo Automático" },
];

export default function App({ onLogout }: { onLogout: () => void }) {
  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  return (
    <div className="layout">
      <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
        <div className="brand">🌀 SpinFlow</div>
        <nav style={{ flex: 1 }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button className="secondary" onClick={logout}>Sair</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
