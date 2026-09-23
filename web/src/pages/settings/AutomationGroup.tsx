import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type WhatsAppGroup } from "../../api";
import BackLink from "./BackLink";

const commands = [
  { cmd: "(link cru)", effect: "Converte e dispara pra todos os grupos de envio agora" },
  { cmd: "preview: <link>", effect: "Salva no catálogo e responde com o preview renderizado, sem disparar" },
  { cmd: "converter: <link>", effect: "Responde só com o link de afiliado convertido" },
  { cmd: "salvar: <link>", effect: "Salva no catálogo (entra na fila do disparo automático)" },
  { cmd: "salvar_prioridade: <link>", effect: "Salva com prioridade (fura a fila)" },
  { cmd: "envio: <texto>", effect: "Manda um comunicado de texto pra todos os grupos de envio" },
  { cmd: "envio_automatico_on / _off", effect: "Liga/desliga o disparo automático" },
];

export default function AutomationGroup() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);

  useEffect(() => {
    api.groups().then(setGroups).catch(() => {});
  }, []);

  const active = groups.find((g) => g.isAutomationGroup);

  return (
    <div>
      <BackLink />
      <h1>Grupo de Automação</h1>
      <p className="subtitle">Um grupo de WhatsApp vira seu "controle remoto" — comandos de texto substituem o painel</p>

      <div className="card">
        <h2>Grupo ativo</h2>
        {active ? (
          <div className="row">
            <span className="badge green">{active.name}</span>
            <Link to="/grupos" className="btn secondary" style={{ marginLeft: "auto" }}>
              Trocar em Grupos →
            </Link>
          </div>
        ) : (
          <div>
            <p className="empty" style={{ padding: "8px 0" }}>Nenhum grupo designado ainda.</p>
            <Link to="/grupos" className="btn">Designar um grupo →</Link>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "18px 20px 0" }}>
          <h2>Comandos disponíveis</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Comando</th>
              <th>Efeito</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((c) => (
              <tr key={c.cmd}>
                <td><code>{c.cmd}</code></td>
                <td style={{ fontSize: 13 }}>{c.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
