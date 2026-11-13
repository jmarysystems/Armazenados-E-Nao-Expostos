-- =====================================================================
-- Armazenados e Não Expostos — estrutura (convive com o Cota-Certa)
--
-- Mesma base: reaproveita public.produtos e public.usuarios.
-- Tudo que é exclusivo do Armazenados usa o prefixo arm_.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Perfil novo em usuarios (isolamento em relação ao Cota-Certa)
-- ---------------------------------------------------------------------
alter table public.usuarios drop constraint if exists usuarios_tipo_check;
alter table public.usuarios add constraint usuarios_tipo_check
  check (tipo in ('admin_sistema', 'administrador', 'leitura', 'fornecedor', 'armazenados'));

-- ---------------------------------------------------------------------
-- 2. Produtos compartilhados: colunas de classificação do Armazenados
-- ---------------------------------------------------------------------
create table if not exists public.arm_categorias (
  id              uuid primary key default gen_random_uuid(),
  codigo_auxiliar text,
  descricao       text not null,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.usuarios(id) on delete set null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.usuarios(id) on delete set null,
  constraint arm_categorias_unica unique (descricao)
);

create table if not exists public.arm_subcategorias (
  id              uuid primary key default gen_random_uuid(),
  categoria_id    uuid not null references public.arm_categorias(id) on delete restrict,
  codigo_auxiliar text,
  descricao       text not null,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.usuarios(id) on delete set null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.usuarios(id) on delete set null,
  constraint arm_subcategorias_unica unique (categoria_id, descricao)
);

create table if not exists public.arm_familias (
  id              uuid primary key default gen_random_uuid(),
  categoria_id    uuid not null references public.arm_categorias(id) on delete restrict,
  subcategoria_id uuid not null references public.arm_subcategorias(id) on delete restrict,
  codigo_auxiliar text,
  descricao       text not null,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.usuarios(id) on delete set null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.usuarios(id) on delete set null,
  constraint arm_familias_unica unique (subcategoria_id, descricao)
);

alter table public.produtos
  add column if not exists categoria_id    uuid references public.arm_categorias(id) on delete set null,
  add column if not exists subcategoria_id uuid references public.arm_subcategorias(id) on delete set null,
  add column if not exists familia_id      uuid references public.arm_familias(id) on delete set null,
  add column if not exists embalagem       text;

-- EAN obrigatório: quando não informado, recebe o SKU (regra do sistema antigo)
create or replace function public.fn_produto_completa_ean()
returns trigger
language plpgsql
as $$
begin
  if new.ean is null or btrim(new.ean) = '' then
    new.ean := nullif(btrim(new.sku), '');
  end if;
  if new.ean is null or btrim(new.ean) = '' then
    raise exception 'Informe o EAN ou o SKU do produto.' using errcode = '23502';
  end if;
  return new;
end
$$;

drop trigger if exists trg_produto_completa_ean on public.produtos;
create trigger trg_produto_completa_ean
  before insert or update on public.produtos
  for each row execute function public.fn_produto_completa_ean();

create unique index if not exists produtos_ean_unico
  on public.produtos (btrim(ean));

-- ---------------------------------------------------------------------
-- 3. Lojas e perfil do Armazenados por usuário
-- ---------------------------------------------------------------------
create table if not exists public.arm_lojas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  codigo    text,
  ativa     boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint arm_lojas_nome_unico unique (nome)
);

create table if not exists public.arm_usuarios (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  loja_id    uuid references public.arm_lojas(id) on delete set null,
  perfil     text not null default 'auditor',
  criado_em  timestamptz not null default now(),
  constraint arm_usuarios_unico unique (usuario_id),
  constraint arm_usuarios_perfil_check check (perfil in ('admin', 'gerente', 'auditor'))
);

-- ---------------------------------------------------------------------
-- 4. Auditorias (o ARMAZENADOS_E_NAO_EXPOSTOS do legado)
-- ---------------------------------------------------------------------
create table if not exists public.arm_auditorias (
  id             uuid primary key default gen_random_uuid(),
  loja_id        uuid not null references public.arm_lojas(id),
  remetente_id   uuid references public.usuarios(id) on delete set null,
  remetente_nome text not null default '',
  data_cadastro  timestamptz not null default now(),
  enviado_email  boolean not null default false,
  enviado_em     timestamptz,
  qtd_deposito   integer not null default 0,
  qtd_auditada   integer not null default 0,
  percentual     numeric(7,2) generated always as (
                   case when qtd_auditada > 0
                        then round(qtd_deposito::numeric / qtd_auditada * 100, 2)
                        else 0 end
                 ) stored
);

create index if not exists arm_auditorias_loja_idx
  on public.arm_auditorias (loja_id, data_cadastro desc);

create table if not exists public.arm_auditoria_deposito (
  id           uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.arm_auditorias(id) on delete cascade,
  produto_id   uuid not null references public.produtos(id),
  ean          text,
  sku          text,
  descricao    text not null,
  categoria    text,
  loja_id      uuid references public.arm_lojas(id),
  auditor_nome text,
  ordem        integer not null default 0
);

create index if not exists arm_auditoria_deposito_idx
  on public.arm_auditoria_deposito (auditoria_id, ordem);

create table if not exists public.arm_auditoria_auditados (
  id           uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.arm_auditorias(id) on delete cascade,
  produto_id   uuid not null references public.produtos(id),
  ean          text,
  sku          text,
  descricao    text not null,
  categoria    text,
  ordem        integer not null default 0
);

create index if not exists arm_auditoria_auditados_idx
  on public.arm_auditoria_auditados (auditoria_id, ordem);

commit;
