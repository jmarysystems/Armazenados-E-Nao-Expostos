-- =====================================================================
-- Unicidade por tabela:
--   categorias    -> código auxiliar único + descrição única
--   subcategorias -> código auxiliar único (descrição pode repetir)
--   famílias      -> código auxiliar único (descrição pode repetir)
-- =====================================================================
begin;

do $$
declare
  n int;
begin
  select count(*) into n from (
    select upper(btrim(descricao)) d from public.arm_categorias
     group by 1 having count(*) > 1
  ) x;
  if n > 0 then
    raise exception 'Existem % descrição(ões) repetida(s) em arm_categorias', n;
  end if;
end $$;

create unique index if not exists arm_categorias_descricao_uq
  on public.arm_categorias (upper(btrim(descricao)));

-- garante que subcategorias e famílias NÃO tenham índice global de descrição
drop index if exists public.arm_subcategorias_descricao_uq;
drop index if exists public.arm_familias_descricao_uq;

commit;
