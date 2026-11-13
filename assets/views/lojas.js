// Escolha da loja.
import { listar } from '../api.js';
import * as ui from '../ui.js';

export async function lista(raiz, ctx) {
  const todas = await listar('arm_lojas', { ordem: 'nome' });
  const visiveis = ctx.perfil.perfil === 'admin'
    ? todas
    : todas.filter((l) => l.id === ctx.perfil.loja_id);

  const cards = visiveis.map((l) => `
    <div class="loja">
      <h3>${ui.esc(l.nome)}</h3>
      <p class="nome">ARMAZENADOS E NÃO EXPOSTOS</p>
      <a class="botao botao-primario botao-pequeno" href="#/loja/${ui.esc(l.id)}">ABRIR</a>
    </div>`).join('');

  raiz.innerHTML = `
    <h2 class="titulo-pagina">LOJAS</h2>
    ${visiveis.length ? `<div class="lojas">${cards}</div>`
      : ui.vazio('Nenhuma loja disponível para o seu usuário.')}`;
}
