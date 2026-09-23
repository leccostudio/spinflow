import { useEffect, useState } from "react";
import { api, type PlatformSettings } from "../../api";
import BackLink from "./BackLink";

export default function Platforms() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.platformSettings().then(setSettings);
  }, []);

  function field<K extends keyof PlatformSettings>(key: K) {
    return {
      value: settings ? settings[key] : "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setSettings((s) => (s ? { ...s, [key]: e.target.value } : s)),
    };
  }

  async function save() {
    if (!settings) return;
    setError("");
    setSaved(false);
    try {
      const updated = await api.updatePlatformSettings(settings);
      setSettings(updated);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!settings) return <p className="empty">Carregando...</p>;

  return (
    <div>
      <BackLink />
      <h1>Plataformas</h1>
      <p className="subtitle">Credenciais de afiliado por marketplace</p>

      {error && <div className="error-box">{error}</div>}
      {saved && !error && <div className="badge green" style={{ marginBottom: 14 }}>Salvo</div>}

      <div className="card">
        <h2>🛒 Shopee</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -8 }}>
          Portal de Afiliados Shopee → Abrir API. Aprovação pode levar alguns dias.
        </p>
        <div className="grid-2">
          <div className="field">
            <label>App ID</label>
            <input type="text" {...field("shopeeAppId")} placeholder="Ex.: 18396521139" />
          </div>
          <div className="field">
            <label>App Secret</label>
            <input type="text" {...field("shopeeAppSecret")} placeholder="Senha da API" />
          </div>
        </div>
        <div className="field">
          <label>Sub-IDs de rastreio (até 5, separados por vírgula)</label>
          <input type="text" {...field("shopeeSubIds")} placeholder="campanha1, banner_home" />
        </div>
      </div>

      <div className="card">
        <h2>📦 Amazon</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -8 }}>
          Só a tag de associado é necessária — sem chamada de API.
        </p>
        <div className="field">
          <label>Tag de afiliado</label>
          <input type="text" {...field("amazonAffiliateTag")} placeholder="Ex.: seunome-20" />
        </div>
      </div>

      <div className="card">
        <h2>🛍 Mercado Livre</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -8 }}>
          Gere um link qualquer no portal de afiliados do ML (Ferramentas → Gerador de Link) e olhe os parâmetros{" "}
          <code>matt_word</code> e <code>matt_tool</code> na URL gerada — são fixos, não muda a cada link.
        </p>
        <div className="grid-2">
          <div className="field">
            <label>Tag (matt_word)</label>
            <input type="text" {...field("mercadoLivreTag")} placeholder="Ex.: promospin" />
          </div>
          <div className="field">
            <label>Código (matt_tool)</label>
            <input type="text" {...field("mercadoLivreCode")} placeholder="Ex.: 39250867" />
          </div>
        </div>
      </div>

      <button onClick={save}>Salvar credenciais</button>
    </div>
  );
}
