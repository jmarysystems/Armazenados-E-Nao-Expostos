-- =====================================================================
-- Armazenados e Não Expostos — permissões e regra de negócio
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Identidade (o login é o mesmo do Cota-Certa; o perfil é do Armazenados)
-- ---------------------------------------------------------------------
create or replace function public.arm_usuario_id()
returns uuid
language sql stable security definer set search_path to 'public'
as $$
  select id from public.usuarios where auth_user_id = auth.uid() and ativo limit 1
$$;

create or replace function public.arm_perfil()
returns text
language sql stable security definer set search_path to 'public'
as $$
  select a.perfil
    from public.arm_usuarios a
    join public.usuarios u on u.id = a.usuario_id
   where u.auth_user_id = auth.uid() and u.ativo
   limit 1
$$;

create or replace function public.arm_minha_loja()
returns uuid
language sql stable security definer set search_path to 'public'
as $$
  select a.loja_id
    from public.arm_usuarios a
    join public.usuarios u on u.id = a.usuario_id
   where u.auth_user_id = auth.uid() and u.ativo
   limit 1
$$;

create or replace function public.arm_eh_admin()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(public.arm_perfil() = 'admin', false)
$$;

create or replace function public.arm_pode_ver_auditoria(p_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.arm_auditorias a
     where a.id = p_id
       and (
         public.arm_perfil() = 'admin'
         or (public.arm_perfil() = 'gerente' and a.loja_id = public.arm_minha_loja())
         or a.remetente_id = public.arm_usuario_id()
       )
  )
$$;

-- ---------------------------------------------------------------------
-- Produtos compartilhados: acesso do Armazenados (somado às regras do Cota-Certa)
-- ---------------------------------------------------------------------
drop policy if exists "armazenados le produtos" on public.produtos;
create policy "armazenados le produtos" on public.produtos
  for select to authenticated
  using (exists (select 1 from public.arm_usuarios a where a.usuario_id = public.arm_usuario_id()));

drop policy if exists "armazenados mantem produtos" on public.produtos;
create policy "armazenados mantem produtos" on public.produtos
  for insert to authenticated
  with check (public.arm_perfil() in ('admin', 'gerente'));

drop policy if exists "armazenados edita produtos" on public.produtos;
create policy "armazenados edita produtos" on public.produtos
  for update to authenticated
  using (public.arm_perfil() in ('admin', 'gerente'))
  with check (public.arm_perfil() in ('admin', 'gerente'));

-- ---------------------------------------------------------------------
-- RLS das tabelas do Armazenados
-- ---------------------------------------------------------------------
alter table public.arm_lojas               enable row level security;
alter table public.arm_usuarios            enable row level security;
alter table public.arm_categorias          enable row level security;
alter table public.arm_subcategorias       enable row level security;
alter table public.arm_familias            enable row level security;
alter table public.arm_auditorias          enable row level security;
alter table public.arm_auditoria_deposito  enable row level security;
alter table public.arm_auditoria_auditados enable row level security;

do $$
declare t text;
begin
  foreach t in array array['arm_lojas','arm_categorias','arm_subcategorias','arm_familias'] loop
    execute format('drop policy if exists "ler %1$s" on public.%1$I', t);
    execute format('create policy "ler %1$s" on public.%1$I for select to authenticated
                    using (public.arm_perfil() is not null)', t);
    execute format('drop policy if exists "admin gerencia %1$s" on public.%1$I', t);
    execute format('create policy "admin gerencia %1$s" on public.%1$I for all to authenticated
                    using (public.arm_eh_admin()) with check (public.arm_eh_admin())', t);
  end loop;
end $$;

-- arm_usuarios: cada um vê o próprio; admin vê todos
drop policy if exists "arm ver usuarios" on public.arm_usuarios;
create policy "arm ver usuarios" on public.arm_usuarios
  for select to authenticated
  using (usuario_id = public.arm_usuario_id() or public.arm_eh_admin());

drop policy if exists "arm admin gerencia usuarios" on public.arm_usuarios;
create policy "arm admin gerencia usuarios" on public.arm_usuarios
  for all to authenticated
  using (public.arm_eh_admin()) with check (public.arm_eh_admin());

-- auditorias
drop policy if exists "arm ler auditorias" on public.arm_auditorias;
create policy "arm ler auditorias" on public.arm_auditorias
  for select to authenticated
  using (
    public.arm_perfil() = 'admin'
    or (public.arm_perfil() = 'gerente' and loja_id = public.arm_minha_loja())
    or remetente_id = public.arm_usuario_id()
  );

drop policy if exists "arm registrar auditoria" on public.arm_auditorias;
create policy "arm registrar auditoria" on public.arm_auditorias
  for insert to authenticated
  with check (remetente_id = public.arm_usuario_id());

drop policy if exists "arm atualizar auditoria" on public.arm_auditorias;
create policy "arm atualizar auditoria" on public.arm_auditorias
  for update to authenticated
  using (remetente_id = public.arm_usuario_id() or public.arm_eh_admin())
  with check (remetente_id = public.arm_usuario_id() or public.arm_eh_admin());

drop policy if exists "arm excluir auditoria" on public.arm_auditorias;
create policy "arm excluir auditoria" on public.arm_auditorias
  for delete to authenticated using (public.arm_eh_admin());

do $$
declare t text;
begin
  foreach t in array array['arm_auditoria_deposito','arm_auditoria_auditados'] loop
    execute format('drop policy if exists "ler itens de %1$s" on public.%1$I', t);
    execute format('create policy "ler itens de %1$s" on public.%1$I for select to authenticated
                    using (public.arm_pode_ver_auditoria(auditoria_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Regra: verificar códigos (EAN primeiro, depois SKU)
-- ---------------------------------------------------------------------
create or replace function public.arm_verificar_codigos(p_codigos text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_codigo text;
  v_produto record;
  v_ok jsonb := '[]'::jsonb;
  v_faltantes jsonb := '[]'::jsonb;
begin
  if public.arm_usuario_id() is null then
    raise exception 'Usuário sem acesso ao Armazenados.' using errcode = '42501';
  end if;

  for v_codigo in
    select btrim(c) from regexp_split_to_table(coalesce(p_codigos, ''), '\r?\n') c
     where btrim(c) <> ''
  loop
    v_produto := null;

    select * into v_produto from public.produtos p
     where btrim(p.ean) = v_codigo limit 1;

    if v_produto is null then
      select * into v_produto from public.produtos p
       where upper(btrim(p.sku)) = upper(v_codigo) limit 1;
    end if;

    if v_produto is null then
      v_faltantes := v_faltantes || to_jsonb(v_codigo);
    else
      v_ok := v_ok || jsonb_build_object(
        'codigo', v_codigo,
        'produto_id', v_produto.id,
        'ean', v_produto.ean,
        'sku', v_produto.sku,
        'descricao', v_produto.descricao,
        'categoria', (select c.descricao from public.arm_categorias c where c.id = v_produto.categoria_id));
    end if;
  end loop;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_faltantes) = 0,
    'total', jsonb_array_length(v_ok) + jsonb_array_length(v_faltantes),
    'encontrados', v_ok,
    'faltantes', v_faltantes);
end
$$;

-- ---------------------------------------------------------------------
-- Regra: processar a auditoria (grava as duas listas)
-- ---------------------------------------------------------------------
create or replace function public.arm_processar_auditoria(
  p_loja_id uuid,
  p_codigos_deposito text,
  p_codigos_auditados text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario uuid;
  v_nome text;
  v_dep jsonb;
  v_aud jsonb;
  v_auditoria uuid;
  v_item jsonb;
  v_ordem int;
  v_qtd_dep int;
  v_qtd_aud int;
begin
  v_usuario := public.arm_usuario_id();
  if v_usuario is null then
    raise exception 'Usuário sem acesso ao Armazenados.' using errcode = '42501';
  end if;
  if public.arm_perfil() not in ('admin', 'gerente')
     and p_loja_id <> public.arm_minha_loja() then
    raise exception 'Sem acesso a esta loja.' using errcode = '42501';
  end if;

  select nome into v_nome from public.usuarios where id = v_usuario;
  if not exists (select 1 from public.arm_lojas where id = p_loja_id) then
    raise exception 'Loja inválida.' using errcode = 'P0002';
  end if;

  v_dep := public.arm_verificar_codigos(p_codigos_deposito);
  v_aud := public.arm_verificar_codigos(p_codigos_auditados);

  if not (v_dep->>'ok')::boolean or not (v_aud->>'ok')::boolean then
    return jsonb_build_object(
      'ok', false,
      'faltantes_deposito', v_dep->'faltantes',
      'faltantes_auditados', v_aud->'faltantes');
  end if;

  v_qtd_dep := (v_dep->>'total')::int;
  v_qtd_aud := (v_aud->>'total')::int;

  if v_qtd_dep = 0 then
    raise exception 'A lista "Armazenados e Não Expostos" está vazia.' using errcode = 'P0001';
  end if;

  insert into public.arm_auditorias
    (loja_id, remetente_id, remetente_nome, qtd_deposito, qtd_auditada)
  values (p_loja_id, v_usuario, coalesce(v_nome, ''), v_qtd_dep, v_qtd_aud)
  returning id into v_auditoria;

  v_ordem := 0;
  for v_item in select * from jsonb_array_elements(v_dep->'encontrados') loop
    v_ordem := v_ordem + 1;
    insert into public.arm_auditoria_deposito
      (auditoria_id, produto_id, ean, sku, descricao, categoria, loja_id, auditor_nome, ordem)
    values (v_auditoria, (v_item->>'produto_id')::uuid, v_item->>'ean', v_item->>'sku',
            v_item->>'descricao', v_item->>'categoria', p_loja_id, v_nome, v_ordem);
  end loop;

  v_ordem := 0;
  for v_item in select * from jsonb_array_elements(v_aud->'encontrados') loop
    v_ordem := v_ordem + 1;
    insert into public.arm_auditoria_auditados
      (auditoria_id, produto_id, ean, sku, descricao, categoria, ordem)
    values (v_auditoria, (v_item->>'produto_id')::uuid, v_item->>'ean', v_item->>'sku',
            v_item->>'descricao', v_item->>'categoria', v_ordem);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'auditoria_id', v_auditoria,
    'qtd_deposito', v_qtd_dep,
    'qtd_auditada', v_qtd_aud,
    'percentual', case when v_qtd_aud > 0 then round(v_qtd_dep::numeric / v_qtd_aud * 100, 2) else 0 end);
end
$$;

revoke execute on function public.arm_verificar_codigos(text) from public;
revoke execute on function public.arm_processar_auditoria(uuid, text, text) from public;
grant execute on function public.arm_verificar_codigos(text) to authenticated;
grant execute on function public.arm_processar_auditoria(uuid, text, text) to authenticated;

commit;
