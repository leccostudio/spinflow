import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Visão Geral", end: true },
  { to: "/grupos", label: "Grupos" },
  { to: "/produtos", label: "Produtos" },
  { to: "/templates", label: "Templates" },
  { to: "/agendamentos", label: "Agendamentos" },
  { to: "/configuracoes", label: "Disparo Automático" },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">🌀 SpinFlow</div>
        <nav>
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
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
