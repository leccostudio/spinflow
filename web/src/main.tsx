import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Login from "./Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Accounts from "./pages/Accounts.tsx";
import Groups from "./pages/Groups.tsx";
import Products from "./pages/Products.tsx";
import GerarLinks from "./pages/GerarLinks.tsx";
import Financeiro from "./pages/Financeiro.tsx";
import Templates from "./pages/Templates.tsx";
import Scheduled from "./pages/Scheduled.tsx";
import SettingsHub from "./pages/settings/SettingsHub.tsx";
import AutoDispatch from "./pages/settings/AutoDispatch.tsx";
import AutomationGroup from "./pages/settings/AutomationGroup.tsx";
import Platforms from "./pages/settings/Platforms.tsx";
import Monitoring from "./pages/settings/Monitoring.tsx";
import Advanced from "./pages/settings/Advanced.tsx";
import Site from "./pages/settings/Site.tsx";
import { api } from "./api.ts";

function Root() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .authStatus()
      .then((s) => setAuthenticated(s.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) return null;
  if (!authenticated) return <Login onSuccess={() => setAuthenticated(true)} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App onLogout={() => setAuthenticated(false)} />}>
          <Route index element={<Dashboard />} />
          <Route path="contas" element={<Accounts />} />
          <Route path="grupos" element={<Groups />} />
          <Route path="produtos" element={<Products />} />
          <Route path="gerar-links" element={<GerarLinks />} />
          <Route path="templates" element={<Templates />} />
          <Route path="agendamentos" element={<Scheduled />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="configuracoes" element={<SettingsHub />} />
          <Route path="configuracoes/disparo-automatico" element={<AutoDispatch />} />
          <Route path="configuracoes/grupo-automacao" element={<AutomationGroup />} />
          <Route path="configuracoes/plataformas" element={<Platforms />} />
          <Route path="configuracoes/monitoramento" element={<Monitoring />} />
          <Route path="configuracoes/avancado" element={<Advanced />} />
          <Route path="configuracoes/site" element={<Site />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
