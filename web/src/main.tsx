import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Groups from "./pages/Groups.tsx";
import Products from "./pages/Products.tsx";
import Templates from "./pages/Templates.tsx";
import Scheduled from "./pages/Scheduled.tsx";
import Settings from "./pages/Settings.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="grupos" element={<Groups />} />
          <Route path="produtos" element={<Products />} />
          <Route path="templates" element={<Templates />} />
          <Route path="agendamentos" element={<Scheduled />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
