import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Login from "./Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Groups from "./pages/Groups.tsx";
import Products from "./pages/Products.tsx";
import Templates from "./pages/Templates.tsx";
import Scheduled from "./pages/Scheduled.tsx";
import Settings from "./pages/Settings.tsx";
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
          <Route path="grupos" element={<Groups />} />
          <Route path="produtos" element={<Products />} />
          <Route path="templates" element={<Templates />} />
          <Route path="agendamentos" element={<Scheduled />} />
          <Route path="configuracoes" element={<Settings />} />
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
