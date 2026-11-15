-- =====================================================================
-- Código auxiliar obrigatório e único; em branco recebe o ID do registro
-- =====================================================================
begin;

-- 1) preenche o que estiver vazio com o próprio ID
update public.arm_categorias
   set codigo_auxiliar = id::text
 where codigo_auxiliar is null or btrim(codigo_auxiliar) = '';

update public.arm_subcategorias
   set codigo_auxiliar = id::text
 where codigo_auxiliar is null or btrim(codigo_auxiliar) = '';

update public.arm_familias
   set codigo_auxiliar = id::text
 where codigo_auxiliar is null or btrim(codigo_auxiliar) = '';

-- 2) regra: em branco vira o ID (insert e update)
create or replace function public.arm_completa_codigo_auxiliar()
returns trigger
language plpgsql
as $$
begin
  if new.codigo_auxiliar is null or btrim(new.codigo_auxiliar) = '' then
    new.codigo_auxiliar := new.id::text;
  else
    new.codigo_auxiliar := btrim(new.codigo_auxiliar);
  end if;
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['arm_categorias', 'arm_subcategorias', 'arm_familias'] loop
    execute format('drop trigger if exists trg_codigo_auxiliar on public.%1$I', t);
    execute format('create trigger trg_codigo_auxiliar before insert or update on public.%1$I
                    for each row execute function public.arm_completa_codigo_auxiliar()', t);
  end loop;
end $$;

-- 3) não pode ser nulo nem repetido
alter table public.arm_categorias    alter column codigo_auxiliar set not null;
alter table public.arm_subcategorias alter column codigo_auxiliar set not null;
alter table public.arm_familias      alter column codigo_auxiliar set not null;

create unique index if not exists arm_categorias_codigo_uq
  on public.arm_categorias (upper(btrim(codigo_auxiliar)));
create unique index if not exists arm_subcategorias_codigo_uq
  on public.arm_subcategorias (upper(btrim(codigo_auxiliar)));
create unique index if not exists arm_familias_codigo_uq
  on public.arm_familias (upper(btrim(codigo_auxiliar)));

commit;
