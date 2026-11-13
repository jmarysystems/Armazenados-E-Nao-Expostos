// Acesso a dados: Supabase Auth + REST + RPC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY, LOGIN_DOMAIN } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

const TRADUCOES = [
  ['Invalid login credentials', 'CPF/CNPJ ou senha inválidos.'],
  ['Email not confirmed', 'Este login ainda não foi confirmado.'],
  ['row-level security', 'Seu perfil não tem permissão para esta ação.'],
  ['duplicate key value', 'Já existe um registro com este valor.'],
  ['Usuário sem acesso ao Armazenados', 'Seu usuário não tem acesso ao Armazenados.'],
  ['Sem acesso a esta loja', 'Você não tem acesso a esta loja.'],
];

export function traduzErro(erro) {
  const msg = typeof erro === 'string' ? erro : (erro && erro.message) || String(erro);
  for (const [en, pt] of TRADUCOES) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return pt;
  }
  return msg;
}

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
export const emailDoLogin = (doc) => `${soDigitos(doc)}@${LOGIN_DOMAIN}`;

export async function entrar(documento, senha) {
  const entrada = String(documento ?? '').trim();
  const email = entrada.includes('@') ? entrada.toLowerCase() : emailDoLogin(entrada);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzErro(error));
  return data.user;
}

export async function sair() {
  await sb.auth.signOut();
}

export async function sessao() {
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

export async function listar(tabela, opcoes = {}) {
  let q = sb.from(tabela).select(opcoes.select || '*');
  for (const [campo, valor] of Object.entries(opcoes.eq || {})) q = q.eq(campo, valor);
  if (opcoes.ordem) q = q.order(opcoes.ordem, { ascending: opcoes.asc !== false });
  if (opcoes.limite) q = q.limit(opcoes.limite);
  const { data, error } = await q;
  if (error) throw new Error(traduzErro(error));
  return data || [];
}

export async function criar(tabela, dados) {
  const { data, error } = await sb.from(tabela).insert(dados).select();
  if (error) throw new Error(traduzErro(error));
  return Array.isArray(data) ? data[0] : data;
}

export async function atualizar(tabela, id, dados) {
  const { data, error } = await sb.from(tabela).update(dados).eq('id', id).select();
  if (error) throw new Error(traduzErro(error));
  return Array.isArray(data) ? data[0] : data;
}

export async function rpc(nome, args = {}) {
  const { data, error } = await sb.rpc(nome, args);
  if (error) throw new Error(traduzErro(error));
  return data;
}

// Perfil do Armazenados ligado ao usuário logado.
export async function meuPerfil() {
  const s = await sessao();
  if (!s) return null;
  const { data, error } = await sb
    .from('usuarios')
    .select('id, nome, cpf_cnpj, tipo, ativo')
    .eq('auth_user_id', s.user.id)
    .maybeSingle();
  if (error) throw new Error(traduzErro(error));
  if (!data) return null;

  const { data: vinculo } = await sb
    .from('arm_usuarios')
    .select('perfil, loja_id, arm_lojas(nome)')
    .eq('usuario_id', data.id)
    .maybeSingle();

  return { ...data, perfil: vinculo?.perfil || null, loja_id: vinculo?.loja_id || null,
           loja_nome: vinculo?.arm_lojas?.nome || null };
}
