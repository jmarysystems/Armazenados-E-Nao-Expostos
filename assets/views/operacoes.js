// Operações (cards) e escolha de loja.
import { listar } from '../api.js';
import * as ui from '../ui.js';

const OPERACOES = [
  { id: 'armazenados', nome: 'ARMAZENADOS E NÃO EXPOSTOS', desc: 'Controle do que está no depósito', ativa: true },
  { id: 'inventarios', nome: 'INVENTÁRIOS', desc: 'Contagem de estoque', ativa: false },
  { id: 'produtos', nome: 'PRODUTOS POR EAN', desc: 'Cadastro por código de barras', ativa: false },
];

export async function operacoes(raiz, ctx) {
  ctx.setTitulo('Armazenados e Não Expostos');
  const cards = OPERACOES.map((op) => op.ativa
    ? `<a class="operacao" href="#/lojas"><h3>${ui.esc(op.nome)}</h3><p>${ui.esc(op.desc)}</p>
         <span class="botao botao-pequeno">ABRIR</span></a>`
    : `<div class="operacao inativa"><h3>${ui.esc(op.nome)}</h3><p>${ui.esc(op.desc)}</p>
         <span class="botao botao-pequeno" disabled>EM BREVE</span></div>`).join('');

  raiz.innerHTML = `
    <h2 class="titulo-pagina">Gerenciamento de Operações</h2>
    <div class="operacoes">${cards}</div>`;
}

