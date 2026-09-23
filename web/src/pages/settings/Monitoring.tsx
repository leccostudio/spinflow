import { useEffect, useState } from "react";
import { api, type MonitoringSettings } from "../../api";
import BackLink from "./BackLink";

export default function Monitoring() {
  const [settings, setSettings] = useState<MonitoringSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.monitoringSettings().then(setSettings);
  }, []);

  async function save() {
    if (!settings) return;
    setSaved(false);
    const updated = await api.updateMonitoringSettings({ dedupeWindowHours: settings.dedupeWindowHours });
    setSettings(updated);
    setSaved(true);
  }

  if (!settings) return <p className="empty">Carregando...</p>;

  return (
    <div>
      <BackLink />
      <h1>Monitoramento Automático</h1>
      <p className="subtitle">Configure a captura automática de produtos</p>

      {saved && <div className="badge green" style={{ marginBottom: 14 }}>Salvo</div>}

      <div className="card">
        <h2>Horas para bloquear produtos duplicados</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -6 }}>
          Define por quantas horas um produto já capturado não poderá ser salvo novamente. Use <code>0</code> pra
          desativar a regra.
        </p>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Evitar capturar produtos repetidos (horas)</label>
          <input
            type="number"
            min={0}
            value={settings.dedupeWindowHours}
            onChange={(e) => setSettings({ ...settings, dedupeWindowHours: Number(e.target.value) })}
          />
        </div>
        <button onClick={save}>Salvar</button>
      </div>
    </div>
  );
}
