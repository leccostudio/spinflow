import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { api } from "../api";

const PLATAFORMAS: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  amazon: "Amazon",
  outro: "Outro",
};

// --- Parsers robustos pra CSV exportado dos paineis de afiliado ---

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = {
    ";": (firstLine.match(/;/g) || []).length,
    ",": (firstLine.match(/,/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = clean.split("\n")[0] ?? "";
  const delim = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return { headers, rows: nonEmpty };
}

// "R$ 1.234,56" -> 1234.56 ; "1234.56" -> 1234.56
function parseNumberBR(raw: string): number {
  let s = (raw || "").replace(/[R$\s]/gi, "").trim();
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  return Number(s);
}

// dd/mm/yyyy | yyyy-mm-dd | com hora -> yyyy-mm-dd
function parseDate(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const datePart = s.split(/[ T]/)[0];
  const br = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return "";
}

const NONE = "__none__";

export default function ImportarCSV() {
  const [plataforma, setPlataforma] = useState("mercadolivre");
  const [tipo, setTipo] = useState("ganho");
  const [defaultStatus, setDefaultStatus] = useState("aprovado");

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");

  const [colValor, setColValor] = useState("");
  const [colData, setColData] = useState("");
  const [colStatus, setColStatus] = useState(NONE);
  const [colDescricao, setColDescricao] = useState(NONE);
  const [colRef, setColRef] = useState(NONE);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: Array<{ linha: number; erro: string }> } | null>(null);
  const [error, setError] = useState("");

  function guessCol(headers: string[], candidates: string[]): string {
    const lower = headers.map((h) => h.toLowerCase());
    for (const cand of candidates) {
      const idx = lower.findIndex((h) => h.includes(cand));
      if (idx >= 0) return headers[idx];
    }
    return "";
  }

  async function onFile(file: File) {
    setError("");
    setResult(null);
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.headers.length === 0) {
      setError("Não consegui ler cabeçalhos do CSV.");
      return;
    }
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setColValor(guessCol(parsed.headers, ["comiss", "valor", "amount", "commission", "ganho"]));
    setColData(guessCol(parsed.headers, ["data", "date", "dia"]));
    setColStatus(guessCol(parsed.headers, ["status", "situa"]) || NONE);
    setColDescricao(guessCol(parsed.headers, ["produto", "descri", "item", "nome", "title"]) || NONE);
    setColRef(guessCol(parsed.headers, ["pedido", "order", "id", "transac"]) || NONE);
  }

  function colIndex(name: string): number {
    return headers.indexOf(name);
  }

  const preview = useMemo(() => {
    if (!colValor || !colData) return [];
    const vi = colIndex(colValor);
    const di = colIndex(colData);
    const si = colStatus !== NONE ? colIndex(colStatus) : -1;
    const dsi = colDescricao !== NONE ? colIndex(colDescricao) : -1;
    const ri = colRef !== NONE ? colIndex(colRef) : -1;
    return rows.slice(0, 8).map((r) => ({
      valor: parseNumberBR(r[vi] ?? ""),
      data: parseDate(r[di] ?? ""),
      status: si >= 0 ? (r[si] ?? "").trim() : defaultStatus,
      descricao: dsi >= 0 ? (r[dsi] ?? "").trim() : "",
      ref: ri >= 0 ? (r[ri] ?? "").trim() : "",
      rawValor: r[vi] ?? "",
      rawData: r[di] ?? "",
    }));
  }, [rows, headers, colValor, colData, colStatus, colDescricao, colRef, defaultStatus]);

  function mapStatus(raw: string): string {
    const s = (raw || "").toLowerCase();
    if (!s) return defaultStatus;
    if (s.includes("cancel") || s.includes("estorn") || s.includes("recus")) return "cancelado";
    if (s.includes("aprov") || s.includes("valid") || s.includes("complet") || s.includes("pag")) return "aprovado";
    if (s.includes("pend") || s.includes("aguard")) return "pendente";
    return defaultStatus;
  }

  async function doImport() {
    if (!colValor || !colData) {
      setError("Selecione ao menos as colunas de Valor e Data.");
      return;
    }
    const vi = colIndex(colValor);
    const di = colIndex(colData);
    const si = colStatus !== NONE ? colIndex(colStatus) : -1;
    const dsi = colDescricao !== NONE ? colIndex(colDescricao) : -1;
    const ri = colRef !== NONE ? colIndex(colRef) : -1;

    const entries = rows.map((r) => {
      const rawRef = ri >= 0 ? (r[ri] ?? "").trim() : "";
      return {
        tipo,
        plataforma,
        valor: parseNumberBR(r[vi] ?? ""),
        status: si >= 0 ? mapStatus(r[si] ?? "") : defaultStatus,
        dataEvento: parseDate(r[di] ?? ""),
        descricao: dsi >= 0 ? (r[dsi] ?? "").trim() : null,
        // prefixa a plataforma pra chave nao colidir entre marketplaces
        referenciaExterna: rawRef ? `${plataforma}:${rawRef}` : null,
      };
    });

    setImporting(true);
    setError("");
    setResult(null);
    try {
      const res = await api.importFinanceiro(entries);
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Link to="/financeiro" className="row" style={{ gap: 4, fontSize: 13, color: "#6b7280", textDecoration: "none", marginBottom: 8 }}>
        <ArrowLeft size={14} /> Voltar ao Financeiro
      </Link>
      <h1>Importar CSV</h1>
      <p className="subtitle">
        Mercado Livre e Amazon não têm API de comissão — exporte o relatório do painel de afiliados e importe aqui.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="card">
        <h2>1. Origem</h2>
        <div className="grid-2">
          <div className="field">
            <label>Plataforma</label>
            <select value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
              {Object.entries(PLATAFORMAS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Tipo de lançamento</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="ganho">Ganho (comissão)</option>
              <option value="gasto">Gasto</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Arquivo CSV</label>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {fileName && <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{fileName} — {rows.length} linha(s)</p>}
        </div>
      </div>

      {headers.length > 0 && (
        <>
          <div className="card">
            <h2>2. Mapear colunas</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: -8 }}>
              Diga qual coluna do seu CSV corresponde a cada campo. Valor e Data são obrigatórios.
            </p>
            <div className="grid-2">
              <div className="field">
                <label>Valor / Comissão *</label>
                <select value={colValor} onChange={(e) => setColValor(e.target.value)}>
                  <option value="">— selecione —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Data *</label>
                <select value={colData} onChange={(e) => setColData(e.target.value)}>
                  <option value="">— selecione —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Status (opcional)</label>
                <select value={colStatus} onChange={(e) => setColStatus(e.target.value)}>
                  <option value={NONE}>— usar status padrão —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Status padrão (quando sem coluna)</label>
                <select value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)}>
                  <option value="aprovado">Aprovado</option>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
              <div className="field">
                <label>Descrição (opcional)</label>
                <select value={colDescricao} onChange={(e) => setColDescricao(e.target.value)}>
                  <option value={NONE}>— nenhuma —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field">
                <label>ID / Referência p/ evitar duplicar (opcional)</label>
                <select value={colRef} onChange={(e) => setColRef(e.target.value)}>
                  <option value={NONE}>— nenhuma —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", fontWeight: 600 }}>3. Prévia (primeiras {preview.length})</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--bg)" }}>
                    <th style={{ padding: "8px 12px" }}>Data</th>
                    <th style={{ padding: "8px 12px" }}>Valor</th>
                    <th style={{ padding: "8px 12px" }}>Status</th>
                    <th style={{ padding: "8px 12px" }}>Descrição</th>
                    <th style={{ padding: "8px 12px" }}>Referência</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => {
                    const dataOk = !!p.data;
                    const valorOk = isFinite(p.valor);
                    return (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 12px", color: dataOk ? undefined : "var(--danger)" }}>
                          {dataOk ? p.data.split("-").reverse().join("/") : `⚠ ${p.rawData || "vazio"}`}
                        </td>
                        <td style={{ padding: "8px 12px", color: valorOk ? undefined : "var(--danger)" }}>
                          {valorOk ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : `⚠ ${p.rawValor || "vazio"}`}
                        </td>
                        <td style={{ padding: "8px 12px" }}>{mapStatus(p.status)}</td>
                        <td style={{ padding: "8px 12px", color: "#6b7280" }}>{p.descricao || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#6b7280" }}>{p.ref || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="row" style={{ gap: 8 }}>
            <button onClick={doImport} disabled={importing || !colValor || !colData}>
              <Upload size={14} /> {importing ? "Importando..." : `Importar ${rows.length} linha(s)`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="card" style={{ marginTop: 14 }}>
          <strong>Resultado da importação</strong>
          <p style={{ marginTop: 6 }}>
            ✅ {result.imported} importado(s) · ⏭ {result.skipped} já existia(m) · {result.errors.length} com erro
          </p>
          {result.errors.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--danger)", maxHeight: 160, overflow: "auto" }}>
              {result.errors.slice(0, 30).map((e, i) => (
                <div key={i}>Linha {e.linha}: {e.erro}</div>
              ))}
              {result.errors.length > 30 && <div>… e mais {result.errors.length - 30}.</div>}
            </div>
          )}
          {result.imported > 0 && (
            <Link to="/financeiro" className="btn" style={{ marginTop: 10, display: "inline-block", textDecoration: "none" }}>
              Ver no Financeiro
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
