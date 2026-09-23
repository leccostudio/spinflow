import { useEffect, useState } from "react";
import { api, type MessageTemplate, type CapturedProduct } from "../api";

const EXAMPLE = `*{{nome_do_produto}}*

{{#ifGt percentual_desconto 0}}De: ~R$ {{preco_original}}~
{{/ifGt}}*Por: R$ {{preco_com_desconto}}* 🔥

{{#if cupom}}🎟 Cupom: *{{cupom}}*
{{/if}}
Link: {{link_produto}}`;

export default function Templates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [products, setProducts] = useState<CapturedProduct[]>([]);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [name, setName] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [content, setContent] = useState(EXAMPLE);
  const [error, setError] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewProductId, setPreviewProductId] = useState("");

  function load() {
    api.templates().then(setTemplates).catch(() => {});
    api.products().then(setProducts).catch(() => {});
  }

  useEffect(load, []);

  function startNew() {
    setEditing(null);
    setName("");
    setMarketplace("");
    setContent(EXAMPLE);
  }

  function startEdit(t: MessageTemplate) {
    setEditing(t);
    setName(t.name);
    setMarketplace(t.marketplace);
    setContent(t.content);
  }

  async function save() {
    setError("");
    try {
      if (editing) {
        await api.updateTemplate(editing.id, { name, marketplace, content });
      } else {
        await api.createTemplate({ name, marketplace, content });
      }
      startNew();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    await api.deleteTemplate(id);
    if (editing?.id === id) startNew();
    load();
  }

  async function doPreview(templateId: string) {
    if (!previewProductId) {
      setError("Escolha um produto pra pré-visualizar.");
      return;
    }
    try {
      const result = await api.previewTemplate(templateId, previewProductId);
      setPreviewText(result.text);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h1>Templates</h1>
      <p className="subtitle">Variáveis: nome_do_produto, preco_original, preco_com_desconto, percentual_desconto, cupom, link_produto</p>

      {error && <div className="error-box">{error}</div>}

      <div className="grid-2">
        <div className="card">
          <div className="row">
            <h2 style={{ flex: 1 }}>{editing ? `Editando: ${editing.name}` : "Novo template"}</h2>
            {editing && <button className="secondary" onClick={startNew}>+ Novo</button>}
          </div>
          <div className="field">
            <label>Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Marketplace (vazio = genérico)</label>
            <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
              <option value="">Genérico</option>
              <option value="shopee">Shopee</option>
              <option value="amazon">Amazon</option>
              <option value="mercadolivre">Mercado Livre</option>
            </select>
          </div>
          <div className="field">
            <label>Conteúdo</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <button onClick={save}>{editing ? "Salvar alterações" : "Criar template"}</button>
        </div>

        <div className="card">
          <h2>Pré-visualizar</h2>
          <div className="field">
            <label>Produto de teste</label>
            <select value={previewProductId} onChange={(e) => setPreviewProductId(e.target.value)}>
              <option value="">Selecione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.messageText?.split("\n")[0]?.slice(0, 50) || p.sourceUrl}
                </option>
              ))}
            </select>
          </div>
          <button
            className="secondary"
            onClick={() => (editing ? doPreview(editing.id) : setError("Salve o template primeiro pra pré-visualizar."))}
          >
            Gerar preview
          </button>
          {previewText && <pre style={{ marginTop: 12 }}>{previewText}</pre>}
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Marketplace</th>
              <th>Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.marketplace || <span style={{ color: "#6b7280" }}>genérico</span>}</td>
                <td><span className={`badge ${t.isActive ? "green" : "gray"}`}>{t.isActive ? "sim" : "não"}</span></td>
                <td className="row" style={{ gap: 6 }}>
                  <button className="secondary" onClick={() => startEdit(t)}>Editar</button>
                  <button className="danger" onClick={() => remove(t.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
