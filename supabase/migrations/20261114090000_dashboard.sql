-- =====================================================================
-- Armazenados — dashboard (totais gerais, por loja e por categoria)
-- =====================================================================
begin;

create or replace function public.arm_dashboard(
  p_inicio date default null,
  p_fim date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_dep int := 0;
  v_aud int := 0;
  v_lojas jsonb := '[]'::jsonb;
  v_cats jsonb := '[]'::jsonb;
begin
  if public.arm_usuario_id() is null then
    raise exception 'Usuário sem acesso ao Armazenados.' using errcode = '42501';
  end if;

  -- Gerente vê só a própria loja
  with permitidas as (
    select l.id, l.nome
      from public.arm_lojas l
     where public.arm_perfil() = 'admin'
        or l.id = public.arm_minha_loja()
  ), base as (
    select a.id, a.loja_id
      from public.arm_auditorias a
      join permitidas p on p.id = a.loja_id
     where (p_inicio is null or (a.data_cadastro at time zone 'America/Sao_Paulo')::date >= p_inicio)
       and (p_fim is null    or (a.data_cadastro at time zone 'America/Sao_Paulo')::date <= p_fim)
  ), dep as (
    select b.loja_id, count(*)::int as n
      from public.arm_auditoria_deposito d join base b on b.id = d.auditoria_id
     group by 1
  ), aud as (
    select b.loja_id, count(*)::int as n
      from public.arm_auditoria_auditados x join base b on b.id = x.auditoria_id
     group by 1
  )
  select coalesce(sum(coalesce(dep.n,0)),0)::int,
         coalesce(sum(coalesce(aud.n,0)),0)::int
    into v_dep, v_aud
    from permitidas p
    left join dep on dep.loja_id = p.id
    left join aud on aud.loja_id = p.id;

  with permitidas as (
    select l.id, l.nome
      from public.arm_lojas l
     where public.arm_perfil() = 'admin' or l.id = public.arm_minha_loja()
  ), base as (
    select a.id, a.loja_id
      from public.arm_auditorias a
      join permitidas p on p.id = a.loja_id
     where (p_inicio is null or (a.data_cadastro at time zone 'America/Sao_Paulo')::date >= p_inicio)
       and (p_fim is null    or (a.data_cadastro at time zone 'America/Sao_Paulo')::date <= p_fim)
  ), dep as (
    select b.loja_id, count(*)::int as n
      from public.arm_auditoria_deposito d join base b on b.id = d.auditoria_id group by 1
  ), aud as (
    select b.loja_id, count(*)::int as n
      from public.arm_auditoria_auditados x join base b on b.id = x.auditoria_id group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'loja_id', p.id, 'loja', p.nome,
           'qtd_deposito', coalesce(dep.n,0),
           'qtd_auditada', coalesce(aud.n,0),
           'percentual', case when coalesce(aud.n,0) > 0
                              then round(coalesce(dep.n,0)::numeric / aud.n * 100, 2) else 0 end)
         order by p.nome), '[]'::jsonb)
    into v_lojas
    from permitidas p
    left join dep on dep.loja_id = p.id
    left join aud on aud.loja_id = p.id;

  with permitidas as (
    select l.id from public.arm_lojas l
     where public.arm_perfil() = 'admin' or l.id = public.arm_minha_loja()
  ), base as (
    select a.id from public.arm_auditorias a
      join permitidas p on p.id = a.loja_id
     where (p_inicio is null or (a.data_cadastro at time zone 'America/Sao_Paulo')::date >= p_inicio)
       and (p_fim is null    or (a.data_cadastro at time zone 'America/Sao_Paulo')::date <= p_fim)
  ), dep as (
    select coalesce(nullif(btrim(d.categoria),''),'SEM CATEGORIA') as cat, count(*)::int as n
      from public.arm_auditoria_deposito d join base b on b.id = d.auditoria_id group by 1
  ), aud as (
    select coalesce(nullif(btrim(x.categoria),''),'SEM CATEGORIA') as cat, count(*)::int as n
      from public.arm_auditoria_auditados x join base b on b.id = x.auditoria_id group by 1
  ), juntas as (
    select coalesce(dep.cat, aud.cat) as cat, coalesce(dep.n,0) as dep, coalesce(aud.n,0) as aud
      from dep full join aud on aud.cat = dep.cat
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'categoria', cat, 'qtd_deposito', dep, 'qtd_auditada', aud,
           'percentual', case when aud > 0 then round(dep::numeric / aud * 100, 2) else 0 end)
         order by cat), '[]'::jsonb)
    into v_cats
    from juntas;

  return jsonb_build_object(
    'totais', jsonb_build_object(
      'qtd_deposito', v_dep, 'qtd_auditada', v_aud,
      'percentual', case when v_aud > 0 then round(v_dep::numeric / v_aud * 100, 2) else 0 end),
    'por_loja', v_lojas,
    'por_categoria', v_cats);
end
$$;

revoke execute on function public.arm_dashboard(date, date) from public;
grant execute on function public.arm_dashboard(date, date) to authenticated;

commit;
