-- Etapa 7 — Dashboard / relatórios: views agregadas por reserva (RLS nas tabelas base)

CREATE OR REPLACE VIEW public.v_dashboard_kpis_reserva AS
SELECT
  m.reserva_id,
  m.organization_id,
  m.unit_id,
  count(*)::int AS total_materiais,
  count(*) FILTER (WHERE m.status_atual = 'DISPONIVEL')::int AS disponiveis,
  count(*) FILTER (WHERE m.status_atual IN ('CAUTELADO_TEMPORARIO', 'CAUTELADO_PERMANENTE'))::int AS cautelados,
  count(*) FILTER (WHERE m.status_atual = 'MANUTENCAO')::int AS manutencao,
  count(*) FILTER (WHERE m.status_atual = 'BLOQUEADO')::int AS bloqueados
FROM public.materials m
GROUP BY m.reserva_id, m.organization_id, m.unit_id;

CREATE OR REPLACE VIEW public.v_dashboard_alertas_resumo AS
SELECT
  c.reserva_id,
  c.organization_id,
  c.unit_id,
  count(*) FILTER (
    WHERE c.type = 'daily'
      AND c.status IN ('open', 'partial')
      AND c.data_prevista_devolucao IS NOT NULL
      AND c.data_prevista_devolucao < now()
  )::int AS daily_vencidas,
  count(*) FILTER (
    WHERE c.type = 'permanent'
      AND c.status IN ('open', 'partial')
      AND c.review_date IS NOT NULL
      AND c.review_date < now()
  )::int AS vistorias_atrasadas,
  count(*) FILTER (
    WHERE c.type = 'permanent'
      AND c.status IN ('open', 'partial')
      AND c.review_date IS NOT NULL
      AND c.review_date >= now()
      AND c.review_date <= now() + interval '30 days'
  )::int AS vistorias_30d,
  count(*) FILTER (WHERE c.status = 'divergent')::int AS cautelas_divergentes
FROM public.cautelas c
GROUP BY c.reserva_id, c.organization_id, c.unit_id;

COMMENT ON VIEW public.v_dashboard_kpis_reserva IS 'KPIs de material por reserva (Etapa 7).';
COMMENT ON VIEW public.v_dashboard_alertas_resumo IS 'Resumo de alertas operacionais por reserva (Etapa 7).';
