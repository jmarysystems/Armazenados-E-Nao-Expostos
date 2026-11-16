-- =====================================================================
-- Classificação do produto: trio padrão, quantidade por embalagem
-- e leitura das categorias também pelo Cota-Certa
-- =====================================================================
begin;

-- 1) garante "Sem Categoria" -> "Sem Subcategoria" -> "Sem Família"
do $$
declare
  v_cat uuid;
  v_sub uuid;
begin
  select id into v_cat from public.arm_categorias
   where upper(btrim(descricao)) = 'SEM CATEGORIA' limit 1;
  if v_cat is null then
    insert into public.arm_categorias (descricao, codigo_auxiliar)
    values ('Sem Categoria', '0') returning id into v_cat;
  end if;

  select id into v_sub from public.arm_subcategorias
   where categoria_id = v_cat and upper(btrim(descricao)) = 'SEM SUBCATEGORIA' limit 1;
  if v_sub is null then
    insert into public.arm_subcategorias (categoria_id, descricao, codigo_auxiliar)
    values (v_cat, 'Sem Subcategoria', '0') returning id into v_sub;
  end if;

  if not exists (
    select 1 from public.arm_familias
     where subcategoria_id = v_sub and upper(btrim(descricao)) = 'SEM FAMÍLIA'
  ) then
    insert into public.arm_familias (categoria_id, subcategoria_id, descricao, codigo_auxiliar)
    values (v_cat, v_sub, 'Sem Família', '0');
  end if;
end $$;

-- 2) embalagem -> quantidade por embalagem (numérico)
alter table public.produtos rename column embalagem to quantidade_por_embalagem;
alter table public.produtos alter column quantidade_por_embalagem type numeric(12,3)
  using nullif(btrim(quantidade_por_embalagem), '')::numeric;

-- 3) usuários do Cota-Certa também leem a classificação
do $$
declare t text;
begin
  foreach t in array array['arm_categorias', 'arm_subcategorias', 'arm_familias'] loop
    execute format('drop policy if exists "cota le %1$s" on public.%1$I', t);
    execute format('create policy "cota le %1$s" on public.%1$I for select to authenticated
                    using (public.tipo_usuario() in (''admin_sistema'', ''administrador'', ''leitura''))', t);
  end loop;
end $$;

commit;
