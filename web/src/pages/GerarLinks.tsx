import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Copy, Check, RotateCw } from "lucide-react";
import { api, type CapturedProduct } from "../api";

const ML_GENERATOR_URL = "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub";

// Um link ja e "proprio" quando aponta pro ML (meli.la / mercadolivre.com.br).
// tinyurl e o encurtador que geramos automaticamente - conta como "ainda
// precisa do link oficial gerado na conta".
function hasOwnMlLink(p: CapturedProduct): boolean {
  const url = p.affiliateUrl ?? "";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "meli.la" || host.endsWith("mercadolivre.com.br");
  } catch {
    return false;
  }
}

export default function GerarLinks() {
  const [products, setProducts] = useState<CapturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Snapshot congelado: quando inicia o lote, guardamos a lista ordenada de
  // produtos pra o mapeamento linha-a-linha nao quebrar se chegar captura nova.
  const [batch, setBatch] = useState<CapturedProduct[] | null>(null);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string>("");

  function load() {
    setLoading(true);
    api
      .products({ marketplace: "mercadolivre" })
      .then((data) => {
        setProducts(data);
        // pre-seleciona os que ainda nao tem link oficial do ML
        setSelected(new Set(data.filter((p) => !hasOwnMlLink(p)).map((p) => p.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected]
  );

  const sourceLinks = useMemo(
    () => (batch ?? []).map((p) => p.sourceUrl).join("\n"),
    [batch]
  );

  const pastedLines = useMemo(
    () => pasted.split("\n").map((l) => l.trim()).filter((l) => l.length > 0),
    [pasted]
  );

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startBatch() {
    setBatch(selectedProducts);
    setPasted("");
    setApplyResult("");
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(sourceLinks);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setApplyResult("Não consegui copiar automaticamente — selecione o texto e copie manual.");
    }
  }

  async function apply() {
    if (!batch) return;
    const items = batch.map((p, i) => ({ id: p.id, affiliateUrl: pastedLines[i] ?? "" }));
    setApplying(true);
    setApplyResult("");
    try {
      const { results } = await api.setProductLinks(items);
      const ok = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      let msg = `✅ ${ok} link(s) aplicado(s).`;
      if (fail.length > 0) {
        msg += ` ❌ ${fail.length} falhou(aram): ` + fail.map((f) => f.error).join("; ");
      }
      setApplyResult(msg);
      load();
      setBatch(null);
      setPasted("");
    } catch (e) {
      setApplyResult(`❌ ${(e as Error).message}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      <h1>Gerar Links ML</h1>
      <p className="subtitle">
        Gere os links de afiliado oficiais na sua conta do Mercado Livre e cole de volta aqui.
        Nenhuma senha ou sessão é guardada — você gera logado na sua conta.
      </p>

      {!batch && (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <strong>1. Escolha os produtos</strong>
              <button className="secondary" onClick={load} title="Atualizar">
                <RotateCw size={14} />
              </button>
            </div>

            {loading && <div className="empty">Carregando...</div>}
            {!loading && products.length === 0 && (
              <div className="empty">Nenhum produto do Mercado Livre capturado ainda.</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {products.map((p) => (
                <label
                  key={p.id}
                  className="row"
                  style={{ gap: 10, padding: "6px 4px", borderBottom: "1px solid var(--border)" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span style={{ flex: 1, fontSize: 14 }}>{p.display.name}</span>
                  {hasOwnMlLink(p) ? (
                    <span className="badge green">link oficial</span>
                  ) : (
                    <span className="badge" style={{ background: "#fef9c3", color: "#854d0e" }}>
                      pendente
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <button onClick={startBatch} disabled={selectedProducts.length === 0}>
                Iniciar lote ({selectedProducts.length})
              </button>
            </div>
          </div>
          {applyResult && <div className="card" style={{ fontSize: 13 }}>{applyResult}</div>}
        </>
      )}

      {batch && (
        <>
          <div className="card">
            <strong>2. Copie os links de origem</strong>
            <p className="subtitle" style={{ marginTop: 4 }}>
              Abra o{" "}
              <a href={ML_GENERATOR_URL} target="_blank" rel="noreferrer">
                Gerador de links do Mercado Livre <ExternalLink size={11} />
              </a>{" "}
              (logado na sua conta), cole a lista abaixo, gere e copie os links resultantes.
            </p>
            <textarea readOnly value={sourceLinks} rows={Math.min(batch.length + 1, 10)} style={{ fontSize: 12 }} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="secondary" onClick={copySource}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado!" : "Copiar lista"}
              </button>
            </div>
          </div>

          <div className="card">
            <strong>3. Cole os links gerados (na mesma ordem)</strong>
            <p className="subtitle" style={{ marginTop: 4 }}>
              Um link por linha, na mesma ordem da lista acima. Confira o alinhamento antes de aplicar.
            </p>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={Math.min(batch.length + 1, 10)}
              placeholder="https://meli.la/..."
              style={{ fontSize: 12 }}
            />

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {batch.map((p, i) => {
                const link = pastedLines[i];
                return (
                  <div
                    key={p.id}
                    className="row"
                    style={{ gap: 8, fontSize: 12, alignItems: "flex-start" }}
                  >
                    <span style={{ color: "#9ca3af", minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ flex: 1 }}>{p.display.name}</span>
                    <span style={{ flex: 1, wordBreak: "break-all", color: link ? "var(--primary-dark)" : "var(--danger)" }}>
                      {link ?? "— faltando —"}
                    </span>
                  </div>
                );
              })}
              {pastedLines.length > batch.length && (
                <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>
                  ⚠ Você colou {pastedLines.length} links, mas o lote tem {batch.length} produtos. As linhas
                  extras serão ignoradas.
                </div>
              )}
            </div>

            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <button onClick={apply} disabled={applying || pastedLines.length === 0}>
                {applying ? "Aplicando..." : "Aplicar links"}
              </button>
              <button className="secondary" onClick={() => setBatch(null)} disabled={applying}>
                Cancelar
              </button>
            </div>
            {applyResult && <div style={{ marginTop: 10, fontSize: 13 }}>{applyResult}</div>}
          </div>
        </>
      )}
    </div>
  );
}
