import { useEffect, useState } from "react";
import { api, type ScheduledMessage, type WhatsAppGroup, type CapturedProduct } from "../api";

const statusColor: Record<string, string> = {
  PENDING: "yellow",
  SENT: "green",
  FAILED: "red",
  CANCELLED: "gray",
};

export default function Scheduled() {
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [products, setProducts] = useState<CapturedProduct[]>([]);
  const [error, setError] = useState("");

  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [productId, setProductId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  function load() {
    api.scheduledMessages().then(setItems).catch(() => {});
    api.groups().then(setGroups).catch(() => {});
    api.products().then(setProducts).catch(() => {});
  }

  useEffect(load, []);

  const sendGroups = groups.filter((g) => g.isSending);

  async function create() {
    setError("");
    if (selectedGroups.length === 0 || !productId || !scheduledAt) {
      setError("Preencha grupo(s), produto e data/hora.");
      return;
    }
    try {
      await api.createScheduled({
        groupIds: selectedGroups,
        productId,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setSelectedGroups([]);
      setProductId("");
      setScheduledAt("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function cancel(id: string) {
    await api.cancelScheduled(id);
    load();
  }

  function groupNames(ids: string) {
    return ids
      .split(",")
      .map((id) => groups.find((g) => g.id === id)?.name ?? id)
      .join(", ");
  }

  return (
    <div>
      <h1>Agendamentos</h1>
      <p className="subtitle">Verificados a cada 30s por um loop em segundo plano</p>

      {error && <div className="error-box">{error}</div>}

      <div className="card">
        <h2>Novo agendamento</h2>
        <div className="field">
          <label>Produto</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Selecione...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.messageText?.split("\n")[0]?.slice(0, 50) || p.sourceUrl}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Grupos de destino</label>
          <div className="row wrap" style={{ gap: 10 }}>
            {sendGroups.map((g) => (
              <label key={g.id} className="row" style={{ gap: 4, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(g.id)}
                  onChange={(e) =>
                    setSelectedGroups((sg) =>
                      e.target.checked ? [...sg, g.id] : sg.filter((id) => id !== g.id)
                    )
                  }
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Data e hora</label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
        <button onClick={create}>Agendar</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Grupos</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="empty">Nenhum agendamento.</td></tr>
            )}
            {items.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.scheduledAt).toLocaleString("pt-BR")}</td>
                <td style={{ fontSize: 13 }}>{groupNames(s.groupIds)}</td>
                <td><span className={`badge ${statusColor[s.status] ?? "gray"}`}>{s.status}</span></td>
                <td>
                  {s.status === "PENDING" && (
                    <button className="danger" onClick={() => cancel(s.id)}>Cancelar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
