/**
 * So configuracao de infraestrutura (precisa de restart pra mudar) fica em
 * env var. Configuracao de negocio (credenciais de marketplace, filtros de
 * monitoramento) mora no banco - ver src/config/settings.ts - e e editavel
 * pela UI sem reiniciar o servidor.
 */
export const env = {
  port: Number(process.env.PORT ?? 3333),
  authPassword: process.env.AUTH_PASSWORD ?? "",
};
