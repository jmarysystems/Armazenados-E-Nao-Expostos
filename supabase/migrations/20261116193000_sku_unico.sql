-- =====================================================================
-- SKU único por igualdade (permite upsert por SKU na importação)
-- =====================================================================
begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'produtos_sku_unico' and conrelid = 'public.produtos'::regclass
  ) then
    alter table public.produtos add constraint produtos_sku_unico unique (sku);
  end if;
end $$;

commit;
