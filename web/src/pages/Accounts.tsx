import { useEffect, useState } from "react";
import { api, type WhatsAppAccount } from "../api";

const statusLabel: Record<string, { text: string; cls: string }> = {
  CONNECTED: { text: "Conectado", cls: "green" },
  CONNECTING: { text: "Aguardando QR code...", cls: "yellow" },
  DISCONNECTED: { text: "Desconectado", cls: "red" },
};

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
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: -6 }}>
          Depois de criar, o QR code aparece nos <strong>logs do servidor</strong> (terminal onde roda{" "}
          <code>npm run dev</code> ou <code>docker compose logs -f</code>) — escaneie com o número/chip que você quer
          conectar como backup.
        </p>
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
                  <td><span className={`badge ${badge.cls}`}>{badge.text}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
