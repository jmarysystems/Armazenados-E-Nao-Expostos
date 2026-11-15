-- =====================================================================
-- Armazenados — últimos relatórios (sem filtro de data)
-- =====================================================================
begin;

create or replace function public.arm_relatorio_ultimos(p_limite int default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_lista jsonb;
begin
  if public.arm_usuario_id() is null then
    raise exception 'Usuário sem acesso ao Armazenados.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id,
           'data_cadastro', x.data_cadastro,
           'loja', x.loja,
           'qtd_deposito', x.qtd_deposito,
           'qtd_auditada', x.qtd_auditada,
           'percentual', x.percentual,
           'remetente', x.remetente,
           'enviado_email', x.enviado_email)
         order by x.data_cadastro desc), '[]'::jsonb)
    into v_lista
    from (
      select a.id, a.data_cadastro, l.nome as loja,
             a.qtd_deposito, a.qtd_auditada, a.percentual,
             a.remetente_nome as remetente, a.enviado_email
        from public.arm_auditorias a
        join public.arm_lojas l on l.id = a.loja_id
       where public.arm_perfil() = 'admin'
          or a.loja_id = public.arm_minha_loja()
          or a.remetente_id = public.arm_usuario_id()
       order by a.data_cadastro desc
       limit greatest(1, least(coalesce(p_limite, 10), 100))
    ) x;

  return jsonb_build_object('auditorias', v_lista);
end
$$;

revoke execute on function public.arm_relatorio_ultimos(int) from public;
grant execute on function public.arm_relatorio_ultimos(int) to authenticated;

commit;
