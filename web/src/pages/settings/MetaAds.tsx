import { useEffect, useState } from "react";
import { api, type MetaStatus } from "../../api";
import BackLink from "./BackLink";

const statusBadge: Record<string, { cls: string; text: string }> = {
  conectado: { cls: "green", text: "Conectado" },
  erro: { cls: "red", text: "Erro" },
  desconectado: { cls: "gray", text: "Desconectado" },
};

export default function MetaAds() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [appId, setAppId] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [token, setToken] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState(360);
  const [lookback, setLookback] = useState(7);

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function apply(s: MetaStatus) {
    setStatus(s);
    setAppId(s.appId);
    setAdAccountId(s.segmentoId ?? "");
    setSyncEnabled(s.syncEnabled);
    setIntervalMin(s.syncIntervalMinutes);
    setLookback(s.lookbackDays);
  }

  useEffect(() => {
    api.metaStatus().then(apply).catch(() => {});
  }, []);

  async function connect() {
    setBusy("connect");
    setError("");
    setMsg("");
    try {
      const body: Parameters<typeof api.connectMeta>[0] = {
        appId,
        adAccountId,
        syncEnabled,
        syncIntervalMinutes: intervalMin,
        lookbackDays: lookback,
      };
      if (token.trim()) body.accessToken = token.trim();
      const s = await api.connectMeta(body);
      apply(s);
      setToken("");
      if (s.statusConexao === "erro") setError(s.statusMensagem ?? "Falha ao conectar.");
      else setMsg("Configuração salva.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function test() {
    setBusy("test");
    setError("");
    setMsg("");
    try {
      const s = await api.testMeta();
      apply(s);
      setMsg(s.statusMensagem ?? "Conexão OK.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function sync() {
    setBusy("sync");
    setError("");
    setMsg("");
    try {
      const r = await api.syncMeta();
      setMsg(`Sincronizado: ${r.imported} novo(s), ${r.updated} atualizado(s) (${r.total} registro(s) da Meta).`);
      await api.metaStatus().then(apply);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar a Meta? As credenciais serão removidas (os lançamentos já importados permanecem).")) return;
    setBusy("disconnect");
    setError("");
    setMsg("");
    try {
      await api.disconnectMeta();
      await api.metaStatus().then(apply);
      setToken("");
      setMsg("Desconectado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (!status) return <p className="empty">Carregando...</p>;

  const badge = statusBadge[status.statusConexao] ?? statusBadge.desconectado;

  return (
    <div>
      <BackLink />
      <h1>Meta Ads</h1>
      <p className="subtitle">Conecte sua conta e sincronize automaticamente o gasto em anúncios</p>

      {error && <div className="error-box">{error}</div>}
      {msg && !error && <div className="badge green" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Status</h2>
          <span className={`badge ${badge.cls}`}>{badge.text}</span>
        </div>
        {status.statusMensagem && (
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>{status.statusMensagem}</p>
        )}
        {status.ultimaSincronizacao && (
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Última sincronização: {new Date(status.ultimaSincronizacao).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Credenciais</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -8 }}>
          Gere um token com permissão <code>ads_read</code> no Graph API Explorer ou num app da Meta.
          O token é guardado <strong>criptografado</strong> — nunca é exibido de volta.
        </p>
        <div className="grid-2">
          <div className="field">
            <label>App ID</label>
            <input type="text" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="Ex.: 1234567890" />
          </div>
          <div className="field">
            <label>ID da conta de anúncios</label>
            <input type="text" value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Ex.: act_123456789" />
          </div>
        </div>
        <div className="field">
          <label>Access Token ({status.hasToken ? "deixe em branco para manter o atual" : "obrigatório"})</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={status.hasToken ? "•••••••• (token guardado)" : "Cole o token com ads_read"}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="card">
        <h2>Sincronização automática</h2>
        <label className="row" style={{ gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
          Sincronizar o gasto automaticamente em segundo plano
        </label>
        <div className="grid-2">
          <div className="field">
            <label>Intervalo (minutos, mínimo 15)</label>
            <input
              type="number"
              min={15}
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Dias para trás por sincronização (1–90)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button onClick={connect} disabled={busy !== ""}>
          {busy === "connect" ? "Salvando..." : "Salvar e conectar"}
        </button>
        <button className="secondary" onClick={test} disabled={busy !== "" || !status.hasToken}>
          {busy === "test" ? "Testando..." : "Testar conexão"}
        </button>
        <button className="secondary" onClick={sync} disabled={busy !== "" || !status.connected}>
          {busy === "sync" ? "Sincronizando..." : "Sincronizar agora"}
        </button>
        <div className="spacer" />
        {status.hasToken && (
          <button className="danger" onClick={disconnect} disabled={busy !== ""}>
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}
