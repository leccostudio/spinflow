import { useEffect, useState } from "react";
import { Eye, Send, MoreVertical, Pencil, Star, Trash2, Search, RotateCw, ChevronDown } from "lucide-react";
import { api, type CapturedProduct, type WhatsAppGroup, type MessageTemplate } from "../api";

const statusBadge: Record<string, string> = {
  CAPTURED: "gray",
  CONVERTED: "green",
  CONVERSION_FAILED: "red",
};

const marketplaceLabel: Record<string, string> = {
  shopee: "Shopee",
  amazon: "Amazon",
  mercadolivre: "Mercado Livre",
};

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Products() {
  const [products, setProducts] = useState<CapturedProduct[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const [marketplace, setMarketplace] = useState("");
  const [sort, setSort] = useState("");
  const [filter, setFilter] = useState<"" | "favorite" | "pending" | "sent">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [openSendFor, setOpenSendFor] = useState<string | null>(null);
  const [openEditFor, setOpenEditFor] = useState<string | null>(null);
  const [openDetailsFor, setOpenDetailsFor] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({ name: "", priceOriginal: "", priceDiscounted: "", coupon: "" });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    api
      .products({
        marketplace,
        sort,
        favorite: filter === "favorite" ? "true" : undefined,
        search,
      })
      .then((data) => {
        let list = data;
        if (filter === "pending") list = list.filter((p) => !p.dispatchedAt);
        if (filter === "sent") list = list.filter((p) => !!p.dispatchedAt);
        setProducts(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    api.groups().then(setGroups).catch(() => {});
    api.templates().then(setTemplates).catch(() => {});
  }

  useEffect(load, [marketplace, sort, filter, search]);

  const sendGroups = groups.filter((g) => g.isSending);

  function openSend(productId: string) {
    setOpenMenuFor(null);
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

  async function toggleFavorite(p: CapturedProduct) {
    setOpenMenuFor(null);
    const updated = await api.updateProduct(p.id, { favorite: !p.favorite });
    setProducts((ps) => ps.map((x) => (x.id === p.id ? updated : x)));
  }

  async function removeProduct(id: string) {
    setOpenMenuFor(null);
    if (!confirm("Excluir esse produto do catálogo? Não pode ser desfeito.")) return;
    await api.deleteProduct(id);
    setProducts((ps) => ps.filter((x) => x.id !== id));
  }

  function startEdit(p: CapturedProduct) {
    setOpenMenuFor(null);
    setOpenEditFor(p.id);
    setEditForm({
      name: p.nameOverride ?? p.display.name,
      priceOriginal: p.priceOriginalOverride ?? String(p.display.priceOriginal),
      priceDiscounted: p.priceDiscountedOverride ?? String(p.display.priceDiscounted),
      coupon: p.couponOverride ?? p.display.coupon,
    });
  }

  async function saveEdit(id: string) {
    const updated = await api.updateProduct(id, {
      nameOverride: editForm.name || null,
      priceOriginalOverride: editForm.priceOriginal || null,
      priceDiscountedOverride: editForm.priceDiscounted || null,
      couponOverride: editForm.coupon || null,
    });
    setProducts((ps) => ps.map((x) => (x.id === id ? updated : x)));
    setOpenEditFor(null);
  }

  return (
    <div>
      <h1>Produtos</h1>
      <p className="subtitle">{loading ? "Carregando..." : `${products.length} produto(s)`}</p>

      {templates.length === 0 && (
        <div className="error-box">Nenhum template cadastrado — crie um em "Templates" antes de enviar.</div>
      )}

      {/* Barra de filtros */}
      <div className="row wrap" style={{ marginBottom: 18, gap: 10 }}>
        <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)} style={{ width: "auto" }}>
          <option value="">Todas as Plataformas</option>
          <option value="shopee">Shopee</option>
          <option value="amazon">Amazon</option>
          <option value="mercadolivre">Mercado Livre</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: "auto" }}>
          <option value="">Ordenar por: recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="discount_desc">Maior desconto</option>
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} style={{ width: "auto" }}>
          <option value="">Todos os Produtos</option>
          <option value="favorite">Favoritos</option>
          <option value="pending">Aguardando envio</option>
          <option value="sent">Já enviados</option>
        </select>
        <div className="spacer" />
        <input
          type="text"
          placeholder="Pesquisar por nome..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          style={{ width: 200 }}
        />
        <button onClick={() => setSearch(searchInput)}>
          <Search size={14} /> Pesquisar
        </button>
        <button className="secondary" onClick={load} title="Atualizar">
          <RotateCw size={14} />
        </button>
      </div>

      {!loading && products.length === 0 && <div className="empty">Nenhum produto encontrado.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {products.map((p) => {
          const d = p.display;
          return (
            <div key={p.id} className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", background: "var(--bg)", aspectRatio: "4/3" }}>
                {p.imagePath ? (
                  <img
                    src={`/media/${p.imagePath.split(/[\\/]/).pop()}`}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%" }} />
                )}
                {d.discountPercent > 0 && (
                  <span
                    className="badge red"
                    style={{ position: "absolute", top: 8, right: 8 }}
                  >
                    -{d.discountPercent}% OFF
                  </span>
                )}
                <span
                  className="badge"
                  style={{ position: "absolute", bottom: 8, left: 8, background: "#fef9c3", color: "#854d0e" }}
                >
                  {marketplaceLabel[p.marketplace] ?? p.marketplace}
                </span>
              </div>

              <div style={{ padding: 14, flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 600, fontSize: 14, minHeight: 36 }}>{d.name}</div>

                <div style={{ marginTop: 6 }}>
                  {d.priceOriginal > d.priceDiscounted && (
                    <span style={{ textDecoration: "line-through", color: "#9ca3af", fontSize: 13, marginRight: 6 }}>
                      {money(d.priceOriginal)}
                    </span>
                  )}
                  <span style={{ color: "var(--primary-dark)", fontWeight: 700, fontSize: 16 }}>
                    {money(d.priceDiscounted)}
                  </span>
                </div>
                {d.coupon && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>🎟 Cupom: {d.coupon}</div>
                )}

                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                  <span className={`badge ${statusBadge[p.status] ?? "gray"}`}>{p.status}</span>
                  {p.favorite && <Star size={13} fill="#eab308" color="#eab308" />}
                  {p.dispatchedAt && <span className="badge green">enviado (auto)</span>}
                </div>
                {p.conversionError && (
                  <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{p.conversionError}</div>
                )}

                <div className="row" style={{ marginTop: 12, gap: 6, position: "relative" }}>
                  <a
                    href={p.affiliateUrl ?? p.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn secondary"
                    style={{ flex: 1, justifyContent: "center", textDecoration: "none" }}
                  >
                    <Eye size={11} /> Visualizar
                  </a>
                  <button style={{ flex: 1.4, justifyContent: "center" }} onClick={() => openSend(p.id)}>
                    <Send size={13} /> Enviar
                  </button>
                  <button
                    className="secondary"
                    style={{ padding: "8px 10px" }}
                    onClick={() => setOpenMenuFor(openMenuFor === p.id ? null : p.id)}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {openMenuFor === p.id && (
                    <div
                      className="card"
                      style={{
                        position: "absolute",
                        top: 38,
                        right: 0,
                        zIndex: 10,
                        padding: 6,
                        margin: 0,
                        width: 170,
                      }}
                    >
                      <button
                        className="secondary"
                        style={{ width: "100%", justifyContent: "flex-start", background: "transparent", marginBottom: 2 }}
                        onClick={() => startEdit(p)}
                      >
                        <Pencil size={13} /> Editar produto
                      </button>
                      <button
                        className="secondary"
                        style={{ width: "100%", justifyContent: "flex-start", background: "transparent", marginBottom: 2 }}
                        onClick={() => toggleFavorite(p)}
                      >
                        <Star size={13} /> {p.favorite ? "Remover dos favoritos" : "Favoritar produto"}
                      </button>
                      <button
                        className="danger"
                        style={{ width: "100%", justifyContent: "flex-start", background: "transparent" }}
                        onClick={() => removeProduct(p.id)}
                      >
                        <Trash2 size={13} /> Excluir produto
                      </button>
                    </div>
                  )}
                </div>

                {feedback[p.id] && <div style={{ marginTop: 8, fontSize: 12 }}>{feedback[p.id]}</div>}

                {openSendFor === p.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <label>Enviar para</label>
                    <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
                      {sendGroups.length === 0 && <span className="empty">Nenhum grupo "Enviar" ativo.</span>}
                      {sendGroups.map((g) => (
                        <label key={g.id} className="row" style={{ gap: 4, fontSize: 12 }}>
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
                    <div className="row" style={{ gap: 6 }}>
                      <button onClick={() => doSend(p.id)} disabled={sending || selectedGroups.length === 0}>
                        {sending ? "Enviando..." : "Confirmar"}
                      </button>
                      <button className="secondary" onClick={() => setOpenSendFor(null)}>Cancelar</button>
                    </div>
                  </div>
                )}

                {openEditFor === p.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <div className="field">
                      <label>Nome</label>
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="field" style={{ flex: 1 }}>
                        <label>Preço original</label>
                        <input type="text" value={editForm.priceOriginal} onChange={(e) => setEditForm({ ...editForm, priceOriginal: e.target.value })} />
                      </div>
                      <div className="field" style={{ flex: 1 }}>
                        <label>Preço com desconto</label>
                        <input type="text" value={editForm.priceDiscounted} onChange={(e) => setEditForm({ ...editForm, priceDiscounted: e.target.value })} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Cupom</label>
                      <input type="text" value={editForm.coupon} onChange={(e) => setEditForm({ ...editForm, coupon: e.target.value })} />
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button onClick={() => saveEdit(p.id)}>Salvar</button>
                      <button className="secondary" onClick={() => setOpenEditFor(null)}>Cancelar</button>
                    </div>
                  </div>
                )}

                <button
                  className="secondary"
                  style={{ background: "transparent", border: "none", marginTop: 8, padding: 0, fontSize: 12, color: "#6b7280" }}
                  onClick={() => setOpenDetailsFor(openDetailsFor === p.id ? null : p.id)}
                >
                  Mais detalhes <ChevronDown size={12} style={{ transform: openDetailsFor === p.id ? "rotate(180deg)" : undefined }} />
                </button>
                {openDetailsFor === p.id && (
                  <pre style={{ marginTop: 6 }}>{p.messageText}</pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
