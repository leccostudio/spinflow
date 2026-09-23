import { useEffect, useState } from "react";
import { api, type CapturedProduct, type WhatsAppGroup, type MessageTemplate } from "../api";

const statusBadge: Record<string, string> = {
  CAPTURED: "gray",
  CONVERTED: "green",
  CONVERSION_FAILED: "red",
};

export default function Products() {
  const [products, setProducts] = useState<CapturedProduct[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [openSendFor, setOpenSendFor] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function load() {
    api.products().then(setProducts).catch(() => {});
    api.groups().then(setGroups).catch(() => {});
    api.templates().then(setTemplates).catch(() => {});
  }

  useEffect(load, []);

  const sendGroups = groups.filter((g) => g.isSending);

  function openSend(productId: string) {
    setOpenSendFor(openSendFor === productId ? null : productId);
    setSelectedGroups(sendGroups.map((g) => g.id));
  }

  async function doSend(productId: string) {
    if (selectedGroups.length === 0) return;
    setSending(true);
    try {
      const result = await api.sendMessage({ groupIds: selectedGroups, productId });
      const ok = result.results.filter((r) => r.success).length;
      setFeedback((f) => ({ ...f, [productId]: `✅ Enviado para ${ok}/${result.results.length} grupo(s).` }));
      setOpenSendFor(null);
      load();
    } catch (e) {
      setFeedback((f) => ({ ...f, [productId]: `❌ ${(e as Error).message}` }));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Produtos</h1>
      <p className="subtitle">{products.length} produtos capturados</p>

      {templates.length === 0 && (
        <div className="error-box">Nenhum template cadastrado — crie um em "Templates" antes de enviar.</div>
      )}

      {products.length === 0 && <div className="empty">Nenhum produto capturado ainda.</div>}

      {products.map((p) => (
        <div key={p.id} className="card">
          <div className="row">
            {p.imagePath ? (
              <img className="thumb" style={{ width: 64, height: 64 }} src={`/media/${p.imagePath.split(/[\\/]/).pop()}`} alt="" />
            ) : (
              <div className="thumb" style={{ width: 64, height: 64 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {p.messageText?.split("\n")[0]?.replace(/\*/g, "") || p.sourceUrl}
              </div>
              <div className="row" style={{ marginTop: 4, gap: 6 }}>
                <span className="badge gray">{p.marketplace}</span>
                <span className={`badge ${statusBadge[p.status] ?? "gray"}`}>{p.status}</span>
                {p.priority && <span className="badge yellow">prioridade</span>}
                {p.dispatchedAt && <span className="badge green">já enviado (auto)</span>}
                <span style={{ fontSize: 12, color: "#6b7280" }}>via {p.sourceGroup?.name}</span>
              </div>
              {p.conversionError && (
                <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>{p.conversionError}</div>
              )}
            </div>
            <button onClick={() => openSend(p.id)}>Enviar</button>
          </div>

          {feedback[p.id] && <div style={{ marginTop: 10, fontSize: 13 }}>{feedback[p.id]}</div>}

          {openSendFor === p.id && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <label>Enviar para</label>
              <div className="row wrap" style={{ gap: 10, marginBottom: 10 }}>
                {sendGroups.length === 0 && <span className="empty">Nenhum grupo marcado como "Enviar".</span>}
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
              <button onClick={() => doSend(p.id)} disabled={sending || selectedGroups.length === 0}>
                {sending ? "Enviando..." : `Confirmar envio (${selectedGroups.length})`}
              </button>{" "}
              <button className="secondary" onClick={() => setOpenSendFor(null)}>Cancelar</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
