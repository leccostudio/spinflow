import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, RotateCw, TrendingUp, TrendingDown, Wallet, Clock, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type FinancialEntry, type FinancialSummary } from "../api";

const PLATAFORMAS: Record<string, string> = {
  meta: "Meta Ads",
  mercadolivre: "Mercado Livre",
  amazon: "Amazon",
  shopee: "Shopee",
  outro: "Outro",
};

const STATUS_CLS: Record<string, string> = {
  pendente: "yellow",
  aprovado: "green",
  pago: "green",
  cancelado: "gray",
};

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  tipo: "gasto",
  plataforma: "meta",
  valor: "",
  status: "pago",
  dataEvento: today(),
  descricao: "",
  referenciaExterna: "",
};

export default function Financeiro() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [fPlataforma, setFPlataforma] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      api.financeiroEntries({ from, to, plataforma: fPlataforma, tipo: fTipo, status: fStatus }),
      api.financeiroSummary({ from, to, plataforma: fPlataforma }),
    ])
      .then(([e, s]) => {
        setEntries(e);
        setSummary(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, [from, to, fPlataforma, fTipo, fStatus]);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, dataEvento: today() });
    setError("");
    setShowForm(true);
  }

  function openEdit(e: FinancialEntry) {
    setEditingId(e.id);
    setForm({
      tipo: e.tipo,
      plataforma: e.plataforma,
      valor: String(e.valor),
      status: e.status,
      dataEvento: e.dataEvento.slice(0, 10),
      descricao: e.descricao ?? "",
      referenciaExterna: e.referenciaExterna ?? "",
    });
    setError("");
    setShowForm(true);
  }

  // Ao trocar o tipo, ajusta um status padrao coerente.
  function changeTipo(tipo: string) {
    setForm((f) => ({ ...f, tipo, status: tipo === "gasto" ? "pago" : "pendente" }));
  }

  async function save() {
    const valor = Number(form.valor.replace(",", "."));
    if (!isFinite(valor) || valor < 0) {
      setError("Informe um valor válido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        tipo: form.tipo,
        plataforma: form.plataforma,
        valor,
        status: form.status,
        dataEvento: form.dataEvento,
        descricao: form.descricao || null,
        referenciaExterna: form.referenciaExterna || null,
      };
      if (editingId) await api.updateFinanceiro(editingId, body);
      else await api.createFinanceiro(body);
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esse lançamento? Não pode ser desfeito.")) return;
    await api.deleteFinanceiro(id);
    setEntries((es) => es.filter((x) => x.id !== id));
    load();
  }

  const margemPositiva = (summary?.margem ?? 0) >= 0;

  const periodoLabel = useMemo(() => `${from.split("-").reverse().join("/")} — ${to.split("-").reverse().join("/")}`, [from, to]);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Financeiro</h1>
          <p className="subtitle">Gastos e ganhos por período — {periodoLabel}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/financeiro/importar" className="btn secondary" style={{ textDecoration: "none" }}>
            <Upload size={15} /> Importar CSV
          </Link>
          <button onClick={openNew}>
            <Plus size={15} /> Novo lançamento
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--danger-soft, #fee2e2)", color: "var(--danger)" }}>
            <TrendingDown size={17} />
          </div>
          <div className="stat-value">{summary ? money(summary.totalGastos) : "—"}</div>
          <div className="stat-label">Total de gastos</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={17} /></div>
          <div className="stat-value">{summary ? money(summary.ganhosAprovados) : "—"}</div>
          <div className="stat-label">Ganhos aprovados</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Clock size={17} /></div>
          <div className="stat-value">{summary ? money(summary.ganhosPendentes) : "—"}</div>
          <div className="stat-label">Ganhos pendentes</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-icon"
            style={
              margemPositiva
                ? { background: "var(--primary-soft)", color: "var(--primary-dark)" }
                : { background: "var(--danger-soft, #fee2e2)", color: "var(--danger)" }
            }
          >
            <Wallet size={17} />
          </div>
          <div className="stat-value" style={{ color: margemPositiva ? "var(--primary-dark)" : "var(--danger)" }}>
            {summary ? money(summary.margem) : "—"}
          </div>
          <div className="stat-label">Margem (aprovados − gastos)</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="row wrap" style={{ gap: 10, marginBottom: 16, alignItems: "flex-end" }}>
        <div className="field" style={{ margin: 0 }}>
          <label>De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <select value={fPlataforma} onChange={(e) => setFPlataforma(e.target.value)} style={{ width: "auto" }}>
          <option value="">Todas as plataformas</option>
          {Object.entries(PLATAFORMAS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ width: "auto" }}>
          <option value="">Gastos e ganhos</option>
          <option value="gasto">Só gastos</option>
          <option value="ganho">Só ganhos</option>
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ width: "auto" }}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="aprovado">Aprovado</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <div className="spacer" />
        <button className="secondary" onClick={load} title="Atualizar">
          <RotateCw size={14} />
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card">
          <strong>{editingId ? "Editar lançamento" : "Novo lançamento"}</strong>
          <div className="row wrap" style={{ gap: 10, marginTop: 10 }}>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 120 }}>
              <label>Tipo</label>
              <select value={form.tipo} onChange={(e) => changeTipo(e.target.value)}>
                <option value="gasto">Gasto</option>
                <option value="ganho">Ganho</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
              <label>Plataforma</label>
              <select value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.target.value })}>
                {Object.entries(PLATAFORMAS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 110 }}>
              <label>Valor (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 130 }}>
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
              <label>Data</label>
              <input type="date" value={form.dataEvento} onChange={(e) => setForm({ ...form, dataEvento: e.target.value })} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Descrição (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Campanha meias Puma / Comissão pedido #123"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          {error && <div className="error-box" style={{ marginTop: 8 }}>{error}</div>}
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
            <button className="secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading && <div className="empty">Carregando...</div>}
      {!loading && entries.length === 0 && <div className="empty">Nenhum lançamento no período.</div>}

      {!loading && entries.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "var(--bg)" }}>
                <th style={{ padding: "10px 12px" }}>Data</th>
                <th style={{ padding: "10px 12px" }}>Tipo</th>
                <th style={{ padding: "10px 12px" }}>Plataforma</th>
                <th style={{ padding: "10px 12px" }}>Descrição</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Valor</th>
                <th style={{ padding: "10px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    {e.dataEvento.slice(0, 10).split("-").reverse().join("/")}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={`badge ${e.tipo === "ganho" ? "green" : "red"}`}>
                      {e.tipo === "ganho" ? "Ganho" : "Gasto"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{PLATAFORMAS[e.plataforma] ?? e.plataforma}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{e.descricao || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={`badge ${STATUS_CLS[e.status] ?? "gray"}`}>{e.status}</span>
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      color: e.tipo === "ganho" ? "var(--primary-dark)" : "var(--danger)",
                    }}
                  >
                    {e.tipo === "ganho" ? "+" : "−"} {money(e.valor)}
                  </td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    <button className="secondary" style={{ padding: "6px 8px" }} onClick={() => openEdit(e)} title="Editar">
                      <Pencil size={13} />
                    </button>{" "}
                    <button className="danger" style={{ padding: "6px 8px" }} onClick={() => remove(e.id)} title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
