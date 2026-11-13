-- =====================================================================
-- Armazenados e Não Expostos — os três relatórios
-- Percentual = (depósito ÷ auditado) × 100
-- =====================================================================
begin;

create or replace function public.arm_relatorio_dia(p_loja_id uuid, p_data date)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_lista jsonb;
begin
  if public.arm_usuario_id() is null then
    raise exception 'Usuário sem acesso ao Armazenados.' using errcode = '42501';
  end if;
  if public.arm_perfil() <> 'admin' and p_loja_id <> public.arm_minha_loja() then
    raise exception 'Sem acesso a esta loja.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'data_cadastro', a.data_cadastro,
           'loja', l.nome,
           'qtd_deposito', a.qtd_deposito,
           'qtd_auditada', a.qtd_auditada,
           'percentual', a.percentual,
           'remetente', a.remetente_nome,
           'enviado_email', a.enviado_email)
         order by a.data_cadastro desc), '[]'::jsonb)
    into v_lista
    from public.arm_auditorias a
    join public.arm_lojas l on l.id = a.loja_id
   where a.loja_id = p_loja_id
     and (a.data_cadastro at time zone 'America/Sao_Paulo')::date = p_data;

  return jsonb_build_object('loja_id', p_loja_id, 'data', p_data, 'auditorias', v_lista);
end
$$;

create or replace function public.arm_relatorio_periodo(p_loja_id uuid, p_inicio date, p_fim date)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_loja text;
  v_dep int := 0;
  v_aud int := 0;
  v_cats jsonb := '[]'::jsonb;
  v_itens jsonb := '[]'::jsonb;
begin
  if public.arm_usuario_id() is null then
    raise exception 'Usuário sem acesso ao Armazenados.' using errcode = '42501';
  end if;
  if public.arm_perfil() <> 'admin' and p_loja_id <> public.arm_minha_loja() then
    raise exception 'Sem acesso a esta loja.' using errcode = '42501';
  end if;

  select nome into v_loja from public.arm_lojas where id = p_loja_id;

  with base as (
    select a.id, a.data_cadastro
      from public.arm_auditorias a
     where a.loja_id = p_loja_id
       and (a.data_cadastro at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  )
  select
    (select count(*) from public.arm_auditoria_deposito d join base b on b.id = d.auditoria_id),
    (select count(*) from public.arm_auditoria_auditados x join base b on b.id = x.auditoria_id)
  into v_dep, v_aud;

  with base as (
    select a.id from public.arm_auditorias a
     where a.loja_id = p_loja_id
       and (a.data_cadastro at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  ), dep as (
    select coalesce(nullif(btrim(d.categoria), ''), 'SEM CATEGORIA') as cat, count(*)::int as n
      from public.arm_auditoria_deposito d join base b on b.id = d.auditoria_id group by 1
  ), aud as (
    select coalesce(nullif(btrim(x.categoria), ''), 'SEM CATEGORIA') as cat, count(*)::int as n
      from public.arm_auditoria_auditados x join base b on b.id = x.auditoria_id group by 1
  ), juntas as (
    select coalesce(dep.cat, aud.cat) as cat, coalesce(dep.n, 0) as dep, coalesce(aud.n, 0) as aud
      from dep full join aud on aud.cat = dep.cat
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'categoria', cat,
           'qtd_deposito', dep,
           'qtd_auditada', aud,
           'percentual', case when aud > 0 then round(dep::numeric / aud * 100, 2) else 0 end)
         order by cat), '[]'::jsonb)
    into v_cats from juntas;

  with base as (
    select a.id, a.data_cadastro from public.arm_auditorias a
     where a.loja_id = p_loja_id
       and (a.data_cadastro at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'data_cadastro', b.data_cadastro,
           'descricao', d.descricao,
           'ean', d.ean,
           'sku', d.sku,
           'categoria', d.categoria,
           'auditor', d.auditor_nome)
         order by b.data_cadastro, d.ordem), '[]'::jsonb)
    into v_itens
    from public.arm_auditoria_deposito d join base b on b.id = d.auditoria_id;

  return jsonb_build_object(
    'loja_id', p_loja_id, 'loja', v_loja,
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'totais', jsonb_build_object(
      'qtd_deposito', v_dep, 'qtd_auditada', v_aud,
      'percentual', case when v_aud > 0 then round(v_dep::numeric / v_aud * 100, 2) else 0 end),
    'categorias', v_cats,
    'itens', v_itens);
end
$$;

create or replace function public.arm_relatorio_por_loja(p_inicio date, p_fim date)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_perfil text;
  v_minha uuid;
  v_lojas jsonb := '[]'::jsonb;
  v_dep int := 0;
  v_aud int := 0;
begin
  if public.arm_usuario_id() is null then
    raise exception 'Usuário sem acesso ao Armazenados.' using errcode = '42501';
  end if;

  v_perfil := public.arm_perfil();
  v_minha := public.arm_minha_loja();

  with base as (
    select a.id, a.loja_id from public.arm_auditorias a
     where (a.data_cadastro at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  ), dep as (
    select b.loja_id, count(*)::int as n
      from public.arm_auditoria_deposito d join base b on b.id = d.auditoria_id group by 1
  ), aud as (
    select b.loja_id, count(*)::int as n
      from public.arm_auditoria_auditados x join base b on b.id = x.auditoria_id group by 1
  ), linhas as (
    select l.id, l.nome, coalesce(dep.n, 0) as dep, coalesce(aud.n, 0) as aud
      from public.arm_lojas l
      left join dep on dep.loja_id = l.id
      left join aud on aud.loja_id = l.id
     where (v_perfil = 'admin' or l.id = v_minha)
       and coalesce(dep.n, 0) + coalesce(aud.n, 0) > 0
  )
  select coalesce(sum(dep), 0)::int,
         coalesce(sum(aud), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'loja_id', id, 'loja', nome,
           'qtd_deposito', dep, 'qtd_auditada', aud,
           'percentual', case when aud > 0 then round(dep::numeric / aud * 100, 2) else 0 end)
           order by nome), '[]'::jsonb)
    into v_dep, v_aud, v_lojas
    from linhas;

  return jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'totais', jsonb_build_object(
      'qtd_deposito', v_dep, 'qtd_auditada', v_aud,
      'percentual', case when v_aud > 0 then round(v_dep::numeric / v_aud * 100, 2) else 0 end),
    'lojas', v_lojas);
end
$$;

revoke execute on function public.arm_relatorio_dia(uuid, date) from public;
revoke execute on function public.arm_relatorio_periodo(uuid, date, date) from public;
revoke execute on function public.arm_relatorio_por_loja(date, date) from public;

grant execute on function public.arm_relatorio_dia(uuid, date) to authenticated;
grant execute on function public.arm_relatorio_periodo(uuid, date, date) to authenticated;
grant execute on function public.arm_relatorio_por_loja(date, date) to authenticated;

commit;
