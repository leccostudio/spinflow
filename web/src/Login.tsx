import { useState } from "react";
import { api } from "./api";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message || "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <form onSubmit={submit} className="card" style={{ width: 320 }}>
        <div className="brand" style={{ padding: 0, marginBottom: 16 }}>🌀 SpinFlow</div>
        {error && <div className="error-box">{error}</div>}
        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha de acesso"
          />
        </div>
        <button type="submit" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
