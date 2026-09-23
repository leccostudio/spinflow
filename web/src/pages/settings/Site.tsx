import BackLink from "./BackLink";

export default function Site() {
  return (
    <div>
      <BackLink />
      <h1>Site</h1>
      <p className="subtitle">Landing page pública pra captar novos membros do grupo</p>

      <div className="card">
        <h2>Ainda não implementado</h2>
        <p style={{ fontSize: 14, color: "#374151" }}>
          No BuboFlow original, essa tela gera uma landing page pública (título, descrição, cor, logo, link de
          convite do grupo, balanceamento de capacidade entre grupos, Meta Pixel) hospedada num domínio próprio.
        </p>
        <p style={{ fontSize: 14, color: "#374151" }}>
          O SpinFlow ainda não tem esse módulo — é puramente uma ferramenta de operação interna (captura, templates,
          envio), sem front-end público. Dá pra construir se fizer sentido pro seu funil de aquisição, mas é um
          projeto à parte (precisa de hospedagem própria, domínio, etc.) — não implementei sem confirmar que vale a
          pena pra você agora.
        </p>
      </div>
    </div>
  );
}
