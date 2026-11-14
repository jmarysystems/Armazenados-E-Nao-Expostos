// Shell: login, layout com menu lateral e rotas.
import { sb, sair, sessao, meuPerfil, entrar } from './api.js';
import { SISTEMA } from './config.js';
import * as ui from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as operacoes from './views/operacoes.js';
import * as lojas from './views/lojas.js';
import * as cadastrar from './views/cadastrar.js';
import * as relatorios from './views/relatorios.js';
import * as produtos from './views/produtos.js';
import * as cadastros from './views/cadastros.js';

const app = document.getElementById('app');
let perfil = null;

const ROTULOS = {
  admin: 'Administrador',
  gerente: 'Gerente',
  auditor: 'Auditor',
};

function telaLogin(mensagem = '') {
  app.innerHTML = `
    <div class="tela-login">
      <form class="cartao-login" id="form-login">
        <div class="marca"><span class="marca-icone">◫</span>${ui.esc(SISTEMA)}</div>
        <h1>Entrar</h1>
        <p class="sub">Acesso com CPF/CNPJ e senha.</p>
        ${mensagem ? `<div class="erro">${ui.esc(mensagem)}</div>` : ''}
        <label class="campo"><span>CPF/CNPJ ou e-mail</span>
          <input name="documento" autocomplete="username" required autofocus></label>
        <label class="campo"><span>Senha</span>
          <input name="senha" type="password" autocomplete="current-password" required></label>
        <button class="botao-primario" style="width:100%" type="submit">Entrar</button>
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
      iniciarApp();
    } catch (erro) {
      await sair();
      telaLogin(erro.message);
    }
  });
}

function itensDeMenu() {
  const itens = [
    ['#/dashboard', 'Dashboard', '▦'],
    ['#/operacoes', 'Armazenados e Não Expostos', '▤'],
    ['#/relatorios', 'Relatórios', '▣'],
    ['#/produtos', 'Produtos', '◧'],
  ];
  if (perfil.perfil !== 'auditor') {
    itens.push(['#/categorias', 'Categorias', '☰']);
    itens.push(['#/subcategorias', 'Subcategorias', '☷']);
    itens.push(['#/familias', 'Famílias', '☰']);
  }
  return itens;
}

function iniciarApp() {
  const menu = itensDeMenu()
    .map(([href, rotulo, icone]) => `<a class="nav-item" data-rota="${href}" href="${href}">
      <span class="icone">${icone}</span>${ui.esc(rotulo)}</a>`).join('');

  app.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="marca"><span class="marca-icone">◫</span>${ui.esc(SISTEMA)}</div>
        <nav>${menu}</nav>
        <div class="sidebar-rodape">
          <div class="quem">${ui.esc(perfil.nome)}</div>
          <div class="papel">${ui.esc(ROTULOS[perfil.perfil] || perfil.perfil)}</div>
          <button type="button" id="sair">Sair</button>
        </div>
      </aside>
      <div class="conteudo">
        <header class="topbar"><h1 id="titulo">Dashboard</h1></header>
        <main id="view"><div class="carregando">Carregando…</div></main>
      </div>
    </div>`;

  document.getElementById('sair').addEventListener('click', async () => {
    await sair();
    perfil = null;
    telaLogin('Você saiu.');
  });

  if (!location.hash) location.hash = '#/dashboard';
  window.addEventListener('hashchange', navegar);
  navegar();
}

async function navegar() {
  const raiz = document.getElementById('view');
  if (!raiz) return;

  const caminho = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [seg, arg] = caminho.split('/');

  for (const link of document.querySelectorAll('.nav-item')) {
    const rota = link.dataset.rota.replace(/^#\//, '').split('/')[0];
    link.classList.toggle('ativo', rota === seg);
  }

  const ctx = {
    perfil,
    admin: perfil.perfil === 'admin',
    irPara: (hash) => { location.hash = hash; },
    recarregar: () => navegar(),
    setTitulo: (texto) => {
      document.getElementById('titulo').textContent = texto;
      document.title = `${texto} · ${SISTEMA}`;
    },
  };

  raiz.innerHTML = '<div class="carregando">Carregando…</div>';

  try {
    if (seg === 'dashboard') return await dashboard.render(raiz, ctx);
    if (seg === 'operacoes') return await operacoes.operacoes(raiz, ctx);
    if (seg === 'lojas') return await lojas.lista(raiz, ctx);
    if (seg === 'loja') return await cadastrar.render(raiz, ctx, arg);
    if (seg === 'relatorios') return await relatorios.render(raiz, ctx);
    if (seg === 'produtos') return await produtos.render(raiz, ctx);
    if (seg === 'categorias') return await cadastros.categorias(raiz, ctx);
    if (seg === 'subcategorias') return await cadastros.subcategorias(raiz, ctx);
    if (seg === 'familias') return await cadastros.familias(raiz, ctx);
    return await dashboard.render(raiz, ctx);
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

(async function iniciar() {
  try {
    const s = await sessao();
    if (!s) return telaLogin();
    perfil = await meuPerfil();
    if (!perfil || !perfil.perfil) {
      await sair();
      return telaLogin('Seu usuário não tem acesso ao Armazenados.');
    }
    iniciarApp();
  } catch (erro) {
    telaLogin(erro.message);
  }
})();
