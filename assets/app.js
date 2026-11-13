// Shell: login, layout e rotas.
import { sb, sair, sessao, meuPerfil, entrar } from './api.js';
import { SISTEMA } from './config.js';
import * as ui from './ui.js';
import * as operacoes from './views/operacoes.js';
import * as lojas from './views/lojas.js';
import * as cadastrar from './views/cadastrar.js';
import * as relatorios from './views/relatorios.js';
import * as produtos from './views/produtos.js';

const app = document.getElementById('app');
let perfil = null;

function telaLogin(mensagem = '') {
  app.innerHTML = `
    <div class="tela-login">
      <form class="cartao-login" id="form-login">
        <h1>Controle de Acesso</h1>
        <p class="sub">LOGIN</p>
        ${mensagem ? `<div class="erro">${ui.esc(mensagem)}</div>` : ''}
        <label class="campo"><span>Usuário (CPF/CNPJ)</span>
          <input name="documento" autocomplete="username" required autofocus></label>
        <label class="campo"><span>Senha</span>
          <input name="senha" type="password" autocomplete="current-password" required></label>
        <button class="botao-primario" style="width:100%" type="submit">ENTRAR</button>
      </form>
    </div>`;

  const form = document.getElementById('form-login');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const botao = form.querySelector('button');
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    try {
      await entrar(form.documento.value, form.senha.value);
      perfil = await meuPerfil();
      if (!perfil) throw new Error('Sua conta não tem perfil de usuário.');
      if (!perfil.perfil) throw new Error('Seu usuário não tem acesso ao Armazenados.');
      iniciar();
    } catch (erro) {
      await sair();
      telaLogin(erro.message);
    }
  });
}

function iniciar() {
  app.innerHTML = `
    <div class="app">
      <header class="topo">
        <span class="marca">JMarySystems</span>
        <span class="sistema">${ui.esc(SISTEMA)}</span>
        <span class="usuario">USUÁRIO LOGADO: ${ui.esc((perfil.nome || '').toUpperCase())}
          <button type="button" id="sair">Sair</button></span>
      </header>
      <nav class="barra">
        <a href="#/operacoes">Home</a>
        <a href="#/relatorios">Relatórios</a>
        ${perfil.perfil !== 'auditor' ? '<a href="#/produtos">Produtos</a>' : ''}
      </nav>
      <main id="view"><div class="carregando">Carregando…</div></main>
    </div>`;

  document.getElementById('sair').addEventListener('click', async () => {
    await sair();
    perfil = null;
    telaLogin('Você saiu.');
  });

  if (!location.hash) location.hash = '#/operacoes';
  window.addEventListener('hashchange', navegar);
  navegar();
}

async function navegar() {
  const raiz = document.getElementById('view');
  if (!raiz) return;
  const caminho = (location.hash || '#/operacoes').replace(/^#\/?/, '');
  const [seg, arg] = caminho.split('/');

  const ctx = {
    perfil,
    admin: perfil.perfil === 'admin',
    irPara: (hash) => { location.hash = hash; },
    recarregar: () => navegar(),
  };

  raiz.innerHTML = '<div class="carregando">Carregando…</div>';

  try {
    if (seg === 'operacoes') return await operacoes.operacoes(raiz, ctx);
    if (seg === 'lojas') return await lojas.lista(raiz, ctx);
    if (seg === 'loja') return await cadastrar.render(raiz, ctx, arg);
    if (seg === 'relatorios') return await relatorios.render(raiz, ctx);
    if (seg === 'produtos') return await produtos.render(raiz, ctx);
    return await operacoes.operacoes(raiz, ctx);
  } catch (erro) {
    raiz.innerHTML = `<div class="cartao"><h2>Não foi possível carregar</h2>
      <p class="sub">${ui.esc(erro.message)}</p></div>`;
  }
}

sb.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT' && perfil) {
    perfil = null;
    telaLogin('Sessão encerrada.');
  }
});

(async function iniciarApp() {
  try {
    const s = await sessao();
    if (!s) return telaLogin();
    perfil = await meuPerfil();
    if (!perfil || !perfil.perfil) {
      await sair();
      return telaLogin('Seu usuário não tem acesso ao Armazenados.');
    }
    iniciar();
  } catch (erro) {
    telaLogin(erro.message);
  }
})();
