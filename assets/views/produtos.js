// Produtos: catálogo compartilhado com o Cota-Certa, com a classificação do Armazenados.
import { listar, criar, atualizar, sb, traduzErro } from '../api.js';
import * as ui from '../ui.js';

const normaliza = (s) => String(s ?? '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim();

export async function render(raiz, ctx) {
  ctx.setTitulo('Produtos');
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
    <div class="cartao">
      <div class="cartao-topo">
        <h2>${produtos.length} produto(s)</h2>
        <div class="linha-acoes">
          ${podeEditar ? '<button type="button" id="importar">Importar planilha</button>' : ''}
          ${podeEditar ? '<button type="button" id="nova-categoria">Nova categoria</button>' : ''}
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
  raiz.querySelector('#importar')?.addEventListener('click', () => modalImportar(categorias, ctx));

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

function modalImportar(categorias, ctx) {
  const { fechar, corpo } = ui.modal({
    titulo: 'Importar produtos',
    largura: '640px',
    corpo: `
      <p class="sub">Planilha com as colunas <strong>SKU</strong>, <strong>EAN</strong> (opcional),
      <strong>Descrição</strong>, <strong>Unidade</strong> e <strong>Categoria</strong>.
      Categoria que ainda não existir é criada na hora. Aceita .xlsx, .xls e .csv.</p>
      <form id="form-imp">
        <label class="campo"><span>Arquivo *</span>
          <input type="file" name="arquivo" accept=".xlsx,.xls,.csv" required></label>
        <div class="linha-acoes">
          <button type="submit" class="botao-primario">Importar</button>
          <button type="button" id="cancelar">Cancelar</button>
        </div>
      </form>
      <div id="resultado"></div>`,
  });

  corpo.querySelector('#cancelar').addEventListener('click', fechar);

  corpo.querySelector('#form-imp').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const botao = ev.target.querySelector('button[type="submit"]');
    const arquivo = ev.target.arquivo.files[0];
    if (!arquivo) return;
    botao.disabled = true;
    botao.textContent = 'Lendo…';

    try {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const wb = XLSX.read(bytes, { type: 'array' });
      const bruto = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!bruto.length) throw new Error('A planilha está vazia.');

      const mapa = {};
      for (const col of Object.keys(bruto[0])) {
        const n = normaliza(col);
        if (n === 'sku' || n === 'codigo') mapa.sku = col;
        else if (n === 'ean' || n === 'codigo de barras') mapa.ean = col;
        else if (n.startsWith('descri') || n === 'produto') mapa.descricao = col;
        else if (['unidade', 'un', 'und'].includes(n)) mapa.unidade = col;
        else if (n === 'categoria') mapa.categoria = col;
      }
      if (!mapa.sku) throw new Error('Não encontrei a coluna "SKU".');
      if (!mapa.descricao) throw new Error('Não encontrei a coluna "Descrição".');

      let inseridos = 0;
      const erros = [];

      for (const linha of bruto) {
        const sku = String(linha[mapa.sku] ?? '').trim();
        const descricao = String(linha[mapa.descricao] ?? '').trim();
        if (!sku || !descricao) continue;

        const nomeCategoria = mapa.categoria ? String(linha[mapa.categoria] ?? '').trim() : '';
        let categoriaId = null;

        if (nomeCategoria) {
          let achada = categorias.find((c) => normaliza(c.descricao) === normaliza(nomeCategoria));
          if (!achada) {
            try {
              achada = await criar('arm_categorias', { descricao: nomeCategoria });
              categorias.push(achada);
            } catch (_) { achada = null; }
          }
          categoriaId = achada ? achada.id : null;
        }

        const { error } = await sb.from('produtos').insert({
          sku,
          ean: mapa.ean ? String(linha[mapa.ean] ?? '').trim() || null : null,
          descricao,
          unidade: mapa.unidade ? String(linha[mapa.unidade] ?? '').trim() || 'UN' : 'UN',
          categoria_id: categoriaId,
          origem: 'armazenados',
        });

        if (error) erros.push(`${sku}: ${traduzErro(error)}`);
        else inseridos += 1;
      }

      corpo.querySelector('#resultado').innerHTML = `
        <div class="cartao" style="box-shadow:none;margin-top:14px">
          <h3>Resultado</h3>
          <p><strong>${inseridos}</strong> produto(s) importado(s).</p>
          ${erros.length ? `<div class="aviso">${erros.length} linha(s) com problema:<br>
            ${ui.esc(erros.slice(0, 8).join(' · '))}${erros.length > 8 ? ' …' : ''}</div>` : ''}
        </div>`;
      botao.hidden = true;
      ui.toast('Importação concluída.');
      ctx.recarregar();
    } catch (erro) {
      ui.toast(erro.message, 'erro');
      botao.disabled = false;
      botao.textContent = 'Importar';
    }
  });
}
