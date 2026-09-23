import { useEffect, useState } from "react";
import { api, type MonitoringSettings } from "../../api";
import BackLink from "./BackLink";

export default function Advanced() {
  const [settings, setSettings] = useState<MonitoringSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.monitoringSettings().then(setSettings);
  }, []);

  async function save() {
    if (!settings) return;
    setSaved(false);
    const updated = await api.updateMonitoringSettings({
      restrictedWords: settings.restrictedWords,
      allowedWords: settings.allowedWords,
    });
    setSettings(updated);
    setSaved(true);
  }

  if (!settings) return <p className="empty">Carregando...</p>;

  return (
    <div>
      <BackLink />
      <h1>Configurações Avançadas</h1>
      <p className="subtitle">Filtros de palavras aplicados na captura de produtos</p>

      {saved && <div className="badge green" style={{ marginBottom: 14 }}>Salvo</div>}

      <div className="card">
        <h2>Palavras restritas</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -6 }}>
          Mensagens que contenham qualquer uma dessas palavras são descartadas — sempre, independente do resto.
        </p>
        <div className="field">
          <label>Separadas por vírgula</label>
          <input
            type="text"
            value={settings.restrictedWords}
            onChange={(e) => setSettings({ ...settings, restrictedWords: e.target.value })}
            placeholder="academia, sexo, bebida"
          />
        </div>
      </div>

      <div className="card">
        <h2>Palavras permitidas</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -6 }}>
          Quando preenchido, <strong>só</strong> entra mensagem que contenha pelo menos uma dessas palavras — filtro
          mais restritivo, use só se souber todas as palavras do seu nicho.
        </p>
        <div className="field">
          <label>Separadas por vírgula (vazio = sem restrição)</label>
          <input
            type="text"
            value={settings.allowedWords}
            onChange={(e) => setSettings({ ...settings, allowedWords: e.target.value })}
            placeholder="tênis, raquete, esporte"
          />
        </div>
      </div>

      <button onClick={save}>Salvar filtros</button>
    </div>
  );
}
