// Produtos: catálogo compartilhado com o Cota-Certa, com a classificação do Armazenados.
import { listar, criar, atualizar } from '../api.js';
import * as ui from '../ui.js';

export async function render(raiz, ctx) {
  const podeEditar = ctx.perfil.perfil !== 'auditor';
  const [produtos, categorias] = await Promise.all([
    listar('produtos', { select: '*, arm_categorias(descricao)', ordem: 'sku' }),
    listar('arm_categorias', { ordem: 'descricao' }),
  ]);

  const linhas = produtos.map((p) => `
    <tr data-busca="${ui.esc(`${p.sku} ${p.ean} ${p.descricao}`.toLowerCase())}">
      <td class="mono">${ui.esc(p.ean || '—')}</td>
      <td class="mono">${ui.esc(p.sku)}</td>
      <td>${ui.esc(p.descricao)}</td>
      <td>${ui.esc(p.unidade)}</td>
      <td>${ui.esc(p.arm_categorias?.descricao || '—')}</td>
      <td class="num">${podeEditar ? `<button type="button" class="botao-pequeno" data-editar="${ui.esc(p.id)}">Editar</button>` : ''}</td>
    </tr>`).join('');

  raiz.innerHTML = `
    <h2 class="titulo-pagina">Produtos</h2>
    <div class="cartao">
      <div class="cartao-topo">
        <h3>${produtos.length} produto(s)</h3>
        <div class="linha-acoes">
          ${podeEditar ? '<button type="button" class="botao-azul" id="nova-categoria">Nova categoria</button>' : ''}
          ${podeEditar ? '<button type="button" class="botao-primario" id="novo">Novo produto</button>' : ''}
        </div>
      </div>
      <label class="campo" style="max-width:340px"><span>Filtrar</span>
        <input type="search" id="filtro" placeholder="SKU, EAN ou descrição"></label>
      <div class="tabela-rolagem"><table id="tabela">
        <thead><tr><th>EAN</th><th>SKU</th><th>Descrição</th><th>Un.</th><th>Categoria</th><th></th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6">Nenhum produto cadastrado.</td></tr>'}</tbody>
      </table></div>
    </div>`;

  const filtro = raiz.querySelector('#filtro');
  filtro.addEventListener('input', () => {
    const t = filtro.value.toLowerCase();
    for (const tr of raiz.querySelectorAll('#tabela tbody tr')) {
      if (!tr.dataset.busca) continue;
      tr.hidden = t && !tr.dataset.busca.includes(t);
    }
  });

  const abrir = (p) => modalProduto(p, categorias, ctx);

  raiz.querySelector('#novo')?.addEventListener('click', () => abrir({}));
  raiz.querySelector('#nova-categoria')?.addEventListener('click', () => modalCategoria(ctx));

  for (const b of raiz.querySelectorAll('[data-editar]')) {
    b.addEventListener('click', () => abrir(produtos.find((p) => p.id === b.dataset.editar) || {}));
  }
}

function modalProduto(p, categorias, ctx) {
  const editando = !!p.id;
  const opcoes = categorias.map((c) => ({ valor: c.id, rotulo: c.descricao }));

  const { fechar, corpo } = ui.modal({
    titulo: editando ? 'Editar produto' : 'Novo produto',
    largura: '620px',
    corpo: `
      <form id="form-produto" class="grade grade-2">
        ${ui.campoTexto('SKU', 'sku', p.sku, { obrigatorio: true })}
        ${ui.campoTexto('EAN', 'ean', p.ean, { placeholder: 'se vazio, usa o SKU' })}
        ${ui.campoTexto('Descrição', 'descricao', p.descricao, { obrigatorio: true })}
        ${ui.campoTexto('Unidade', 'unidade', p.unidade || 'UN', { obrigatorio: true })}
        ${ui.campoSelect('Categoria', 'categoria_id', opcoes, p.categoria_id, { vazio: '—' })}
        ${ui.campoTexto('Embalagem', 'embalagem', p.embalagem)}
        <div class="linha-acoes campo-largo">
          <button type="submit" class="botao-primario">${editando ? 'Salvar' : 'Cadastrar'}</button>
          <button type="button" id="cancelar">Cancelar</button>
        </div>
      </form>`,
  });

  corpo.querySelector('#cancelar').addEventListener('click', fechar);
  corpo.querySelector('#form-produto').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = ui.dadosDoForm(ev.target);
    const dados = {
      sku: d.sku,
      ean: d.ean || null,
      descricao: d.descricao,
      unidade: d.unidade || 'UN',
      categoria_id: d.categoria_id || null,
      embalagem: d.embalagem || null,
    };
    try {
      if (editando) await atualizar('produtos', p.id, dados);
      else await criar('produtos', { ...dados, origem: 'armazenados' });
      fechar();
      ui.toast(editando ? 'Produto atualizado.' : 'Produto cadastrado.');
      ctx.recarregar();
    } catch (erro) {
      ui.toast(erro.message, 'erro');
    }
  });
}

function modalCategoria(ctx) {
  const { fechar, corpo } = ui.modal({
    titulo: 'Nova categoria',
    corpo: `
      <form id="form-categoria">
        ${ui.campoTexto('Código auxiliar', 'codigo_auxiliar', '', { placeholder: 'opcional' })}
        ${ui.campoTexto('Descrição', 'descricao', '', { obrigatorio: true })}
        <div class="linha-acoes">
          <button type="submit" class="botao-primario">Criar</button>
          <button type="button" id="cancelar">Cancelar</button>
        </div>
      </form>`,
  });

  corpo.querySelector('#cancelar').addEventListener('click', fechar);
  corpo.querySelector('#form-categoria').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = ui.dadosDoForm(ev.target);
    try {
      await criar('arm_categorias', {
        descricao: d.descricao,
        codigo_auxiliar: d.codigo_auxiliar || null,
      });
      fechar();
      ui.toast('Categoria criada.');
      ctx.recarregar();
    } catch (erro) {
      ui.toast(erro.message, 'erro');
    }
  });
}
