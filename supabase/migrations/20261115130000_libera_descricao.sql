-- =====================================================================
-- Subcategorias e famílias: descrição pode repetir livremente.
-- Só o código auxiliar permanece único.
-- =====================================================================
begin;

alter table public.arm_subcategorias drop constraint if exists arm_subcategorias_unica;
alter table public.arm_familias      drop constraint if exists arm_familias_unica;

commit;
