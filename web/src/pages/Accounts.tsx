import { useEffect, useState } from "react";
import { api, type WhatsAppAccount } from "../api";

const statusLabel: Record<string, { text: string; cls: string }> = {
  CONNECTED: { text: "Conectado", cls: "green" },
  CONNECTING: { text: "Aguardando QR code...", cls: "yellow" },
  DISCONNECTED: { text: "Desconectado", cls: "red" },
};

function QrPanel({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      api
        .accountQr(accountId)
        .then((r) => {
          if (!cancelled) setQr(r.qr);
        })
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accountId]);

  if (!qr) {
    return <p style={{ fontSize: 13, color: "#6b7280" }}>Gerando QR code...</p>;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <img src={qr} alt={`QR code para ${accountName}`} width={200} height={200} />
      <p style={{ fontSize: 12, color: "#6b7280", maxWidth: 220 }}>
        WhatsApp → Aparelhos conectados → Conectar aparelho. O código se renova sozinho a cada ~20s até você
        escanear.
      </p>
    </div>
  );
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function load() {
    api.accounts().then(setAccounts).catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function create() {
    setError("");
    setInfo("");
    if (!name.trim()) {
      setError("Digite um nome pra identificar o número (ex.: backup-1).");
      return;
    }
    try {
      const result = await api.createAccount(name.trim());
      setInfo(result.message);
      setName("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h1>Contas WhatsApp</h1>
      <p className="subtitle">
        Cada conta é um número/chip conectado. Grupos podem ter uma conta de backup pra failover — configure em
        "Grupos".
      </p>

      {error && <div className="error-box">{error}</div>}
      {info && <div className="card" style={{ background: "#dcfce7", borderColor: "var(--primary)" }}>{info}</div>}

      <div className="card">
        <h2>Nova conta</h2>
        <div className="row">
          <input
            type="text"
            placeholder="Nome (ex.: backup-1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button onClick={create}>+ Conectar novo número</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Número</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const badge = statusLabel[a.status] ?? statusLabel.DISCONNECTED;
              return (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.phoneNumber ? `+${a.phoneNumber}` : "—"}</td>
                  <td>
                    <span className={`badge ${badge.cls}`}>{badge.text}</span>
                    {a.status === "CONNECTING" && <QrPanel accountId={a.id} accountName={a.name} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
