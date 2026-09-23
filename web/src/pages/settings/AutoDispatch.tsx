import { useEffect, useState } from "react";
import { api, type AutoDispatchSettings } from "../../api";
import BackLink from "./BackLink";

export default function AutoDispatch() {
  const [settings, setSettings] = useState<AutoDispatchSettings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.autoDispatch().then(setSettings);
  }, []);

  function field<K extends keyof AutoDispatchSettings>(key: K) {
    return {
      value: settings ? (settings[key] as unknown as string | number) : "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setSettings((s) => (s ? { ...s, [key]: Number(e.target.value) } : s)),
    };
  }

  async function save() {
    if (!settings) return;
    setError("");
    setSaved(false);
    try {
      const updated = await api.updateAutoDispatch({
        startHour: settings.startHour,
        endHour: settings.endHour,
        minIntervalMinutes: settings.minIntervalMinutes,
        maxIntervalMinutes: settings.maxIntervalMinutes,
        minProductsPerRun: settings.minProductsPerRun,
        maxProductsPerRun: settings.maxProductsPerRun,
      });
      setSettings(updated);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleEnabled(enabled: boolean) {
    setError("");
    try {
      const updated = await api.updateAutoDispatch({ enabled });
      setSettings(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!settings) return <p className="empty">Carregando...</p>;

  return (
    <div>
      <BackLink />
      <h1>Disparo Automático</h1>
      <p className="subtitle">Envia produtos da fila pros grupos de envio sozinho, dentro dos limites abaixo</p>

      <div className="card" style={{ borderColor: settings.enabled ? "var(--primary)" : undefined }}>
        <div className="row">
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 2 }}>Status</h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              {settings.enabled
                ? "Ativo — vai enviar mensagens reais sozinho, dentro da janela e limites configurados."
                : "Desativado — nada será enviado automaticamente."}
            </p>
          </div>
          <button
            className={settings.enabled ? "danger" : ""}
            onClick={() => toggleEnabled(!settings.enabled)}
          >
            {settings.enabled ? "Desativar" : "Ativar"}
          </button>
        </div>
        {settings.nextRunAt && (
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 10 }}>
            Próxima execução: {new Date(settings.nextRunAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
      {saved && !error && <div className="badge green" style={{ marginBottom: 14 }}>Configuração salva</div>}

      <div className="card">
        <h2>Janela e ritmo</h2>
        <div className="grid-2">
          <div className="field">
            <label>Horário de início (0-23)</label>
            <input type="number" min={0} max={23} {...field("startHour")} />
          </div>
          <div className="field">
            <label>Horário de fim (0-23)</label>
            <input type="number" min={0} max={23} {...field("endHour")} />
          </div>
          <div className="field">
            <label>Intervalo mínimo (min) — piso de segurança: 5</label>
            <input type="number" min={5} {...field("minIntervalMinutes")} />
          </div>
          <div className="field">
            <label>Intervalo máximo (min)</label>
            <input type="number" min={5} {...field("maxIntervalMinutes")} />
          </div>
          <div className="field">
            <label>Mín. produtos por execução</label>
            <input type="number" min={1} {...field("minProductsPerRun")} />
          </div>
          <div className="field">
            <label>Máx. produtos por execução — teto de segurança: 5</label>
            <input type="number" min={1} max={5} {...field("maxProductsPerRun")} />
          </div>
        </div>
        <button onClick={save}>Salvar configuração</button>
      </div>
    </div>
  );
}
