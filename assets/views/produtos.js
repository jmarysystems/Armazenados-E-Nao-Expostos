// Produtos: catálogo compartilhado com o Cota-Certa, com a classificação do Armazenados.
import { listar, criar, atualizar, sb, traduzErro } from '../api.js?v=20261116e';
import * as ui from '../ui.js?v=20261116e';

const normaliza = (s) => String(s ?? '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim();

export async function render(raiz, ctx) {
  ctx.setTitulo('Produtos');
  const podeCriarProduto = ctx.pode('produtos', 'cadastrar');
  const podeEditarProduto = ctx.pode('produtos', 'editar');
  const podeCriarCategoria = ctx.pode('categoria', 'cadastrar');
  const [produtos, categorias, subcategorias, familias] = await Promise.all([
    listar('produtos', { select: '*, arm_categorias(descricao)', ordem: 'sku' }),
    listar('arm_categorias', { ordem: 'descricao' }),
    listar('arm_subcategorias', { ordem: 'descricao' }),
    listar('arm_familias', { ordem: 'descricao' }),
  ]);
  const listas = { categorias, subcategorias, familias };

  const linhas = produtos.map((p) => `
    <tr data-busca="${ui.esc(`${p.sku} ${p.ean} ${p.descricao}`.toLowerCase())}">
      <td class="mono">${ui.esc(p.ean || '—')}</td>
      <td class="mono">${ui.esc(p.sku)}</td>
      <td>${ui.esc(p.descricao)}</td>
      <td>${ui.esc(p.unidade)}</td>
      <td>${ui.esc(p.arm_categorias?.descricao || '—')}</td>
      <td class="num">${podeEditarProduto ? `<button type="button" class="botao-pequeno" data-editar="${ui.esc(p.id)}">Editar</button>` : ''}</td>
    </tr>`).join('');

  raiz.innerHTML = `
    <div class="cartao">
      <div class="cartao-topo">
        <h2>${produtos.length} produto(s)</h2>
        <div class="linha-acoes">
          ${podeCriarProduto ? '<button type="button" id="importar">Importar planilha</button>' : ''}
          ${podeCriarCategoria ? '<button type="button" id="nova-categoria">Nova categoria</button>' : ''}
          ${podeCriarProduto ? '<button type="button" class="botao-primario" id="novo">Novo produto</button>' : ''}
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

  const abrir = (p) => modalProduto(p, listas, ctx);

  raiz.querySelector('#novo')?.addEventListener('click', () => abrir({}));
  raiz.querySelector('#nova-categoria')?.addEventListener('click', () => modalCategoria(ctx));
  raiz.querySelector('#importar')?.addEventListener('click', () => modalImportar(listas, ctx));

  for (const b of raiz.querySelectorAll('[data-editar]')) {
    b.addEventListener('click', () => abrir(produtos.find((p) => p.id === b.dataset.editar) || {}));
  }
}

function opcoesDe(itens, valor) {
  return itens.map((x) => `<option value="${ui.esc(x.id)}" ${
    x.id === valor ? 'selected' : ''}>${ui.esc(x.descricao)}</option>`).join('');
}

export function camposClassificacao(listas, p = {}) {
  const { categorias, subcategorias, familias } = listas;
  const semCat = categorias.find((c) => c.descricao.toLowerCase() === 'sem categoria');
  const cat = p.categoria_id || (semCat && semCat.id) || (categorias[0] && categorias[0].id) || '';

  const subs = subcategorias.filter((s) => s.categoria_id === cat);
  const semSub = subs.find((s) => s.descricao.toLowerCase() === 'sem subcategoria');
  const sub = p.subcategoria_id || (semSub && semSub.id) || (subs[0] && subs[0].id) || '';

  const fams = familias.filter((f) => f.subcategoria_id === sub);
  const semFam = fams.find((f) => f.descricao.toLowerCase() === 'sem família');
  const fam = p.familia_id || (semFam && semFam.id) || (fams[0] && fams[0].id) || '';

  return `
    <label class="campo"><span>Categoria</span>
      <select name="categoria_id" data-cat>${opcoesDe(categorias, cat)}</select></label>
    <label class="campo"><span>Subcategoria</span>
      <select name="subcategoria_id" data-sub>${opcoesDe(subs, sub)}</select></label>
    <label class="campo"><span>Família</span>
      <select name="familia_id" data-fam>${opcoesDe(fams, fam)}</select></label>`;
}

export function ligarCascata(escopo, listas) {
  const cat = escopo.querySelector('[data-cat]');
  const sub = escopo.querySelector('[data-sub]');
  const fam = escopo.querySelector('[data-fam]');
  if (!cat || !sub || !fam) return;
  const { subcategorias, familias } = listas;

  const preencher = (sel, itens) => {
    sel.innerHTML = itens.map((x) => `<option value="${ui.esc(x.id)}">${ui.esc(x.descricao)}</option>`).join('');
    const padrao = itens.find((x) => x.descricao.toLowerCase().startsWith('sem '));
    if (padrao) sel.value = padrao.id;
  };

  cat.addEventListener('change', () => {
    preencher(sub, subcategorias.filter((s) => s.categoria_id === cat.value));
    preencher(fam, familias.filter((f) => f.subcategoria_id === sub.value));
  });
  sub.addEventListener('change', () => {
    preencher(fam, familias.filter((f) => f.subcategoria_id === sub.value));
  });
}

function modalProduto(p, listas, ctx) {
  const editando = !!p.id;

  const { fechar, corpo } = ui.modal({
    titulo: editando ? 'Editar produto' : 'Novo produto',
    largura: '660px',
    corpo: `
      <form id="form-produto" class="grade grade-2">
        ${ui.campoTexto('SKU', 'sku', p.sku, { obrigatorio: true })}
        ${ui.campoTexto('EAN', 'ean', p.ean, { placeholder: 'se vazio, usa o SKU' })}
        ${ui.campoTexto('Descrição', 'descricao', p.descricao, { obrigatorio: true })}
        ${ui.campoTexto('Unidade', 'unidade', p.unidade || 'UN', { obrigatorio: true })}
        ${camposClassificacao(listas, p)}
        ${ui.campoTexto('Quantidade por embalagem', 'quantidade_por_embalagem',
          p.quantidade_por_embalagem ?? '', { tipo: 'number', placeholder: 'ex.: 12' })}
        <div class="linha-acoes campo-largo">
          <button type="submit" class="botao-primario">${editando ? 'Salvar' : 'Cadastrar'}</button>
          <button type="button" id="cancelar">Cancelar</button>
        </div>
      </form>`,
  });

  ligarCascata(corpo, listas);
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
      subcategoria_id: d.subcategoria_id || null,
      familia_id: d.familia_id || null,
      quantidade_por_embalagem: d.quantidade_por_embalagem ? Number(d.quantidade_por_embalagem) : null,
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
        ${ui.campoTexto('Código auxiliar', 'codigo_auxiliar', '', { placeholder: 'em branco = ID do registro' })}
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

function modalImportar(listas, ctx) {
  const { categorias, subcategorias, familias } = listas;

  const { fechar, corpo } = ui.modal({
    titulo: 'Importar produtos',
    largura: '700px',
    corpo: `
      <p class="sub">Planilha com as colunas <strong>SKU</strong>, <strong>EAN</strong>,
      <strong>Descrição</strong>, <strong>Unidade</strong>, <strong>Código da Categoria</strong>,
      <strong>Descrição da Categoria</strong>, <strong>Código da Subcategoria</strong>,
      <strong>Descrição da Subcategoria</strong>, <strong>Código da Família</strong> e
      <strong>Descrição da Família</strong>.</p>
      <p class="sub">O <strong>EAN é obrigatório e não pode repetir</strong>. Se o SKU já existir,
      o produto é atualizado em vez de duplicado. Categoria, subcategoria e família são
      procuradas pelo código e criadas quando não existirem.</p>
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
        const n = normaliza(col).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        if (n === 'sku' || n === 'codigo' || n === 'codigo auxiliar') mapa.sku = col;
        else if (n === 'ean' || n.includes('codigo de barras')) mapa.ean = col;
        else if (['unidade', 'un', 'und', 'um'].includes(n)) mapa.unidade = col;
        else if (n.includes('subcategoria')) {
          if (n.includes('codigo')) mapa.subCodigo = col;
          else mapa.subDescricao = col;
        } else if (n.includes('familia')) {
          if (n.includes('codigo')) mapa.famCodigo = col;
          else mapa.famDescricao = col;
        } else if (n.includes('categoria')) {
          if (n.includes('codigo')) mapa.catCodigo = col;
          else mapa.catDescricao = col;
        } else if (n.startsWith('descri') || n === 'produto') mapa.descricao = col;
      }

      if (!mapa.sku) throw new Error('Não encontrei a coluna "SKU".');
      if (!mapa.ean) throw new Error('Não encontrei a coluna "EAN".');
      if (!mapa.descricao) throw new Error('Não encontrei a coluna "Descrição".');

      const erros = [];
      let criadasCat = 0;
      let criadasSub = 0;
      let criadasFam = 0;

      const porCodigo = (lista, codigo) => {
        const alvo = normaliza(codigo);
        if (!alvo) return null;
        return lista.find((x) => normaliza(x.codigo_auxiliar) === alvo) || null;
      };
      const porDescricao = (lista, descricao) => {
        const alvo = normaliza(descricao);
        if (!alvo) return null;
        return lista.find((x) => normaliza(x.descricao) === alvo) || null;
      };

      async function garantirCategoria(cod, nome) {
        if (!cod && !nome) return null;
        let cat = porCodigo(categorias, cod) || porDescricao(categorias, nome);
        if (cat) return cat;
        if (!cod) return null;
        try {
          cat = await criar('arm_categorias', {
            descricao: nome || `Categoria ${cod}`,
            codigo_auxiliar: cod,
          });
          categorias.push(cat);
          criadasCat += 1;
          return cat;
        } catch (e) {
          erros.push(`categoria ${cod}: ${traduzErro(e)}`);
          return null;
        }
      }

      async function garantirSubcategoria(cod, nome, categoriaId) {
        if (!cod && !nome) return null;
        let sub = porCodigo(subcategorias, cod);
        if (!sub && nome) {
          sub = subcategorias.find((x) => normaliza(x.descricao) === normaliza(nome)
            && x.categoria_id === categoriaId) || null;
        }
        if (sub) return sub;
        if (!cod) return null;
        try {
          sub = await criar('arm_subcategorias', {
            descricao: nome || `Subcategoria ${cod}`,
            codigo_auxiliar: cod,
            categoria_id: categoriaId,
          });
          subcategorias.push(sub);
          criadasSub += 1;
          return sub;
        } catch (e) {
          erros.push(`subcategoria ${cod}: ${traduzErro(e)}`);
          return null;
        }
      }

      async function garantirFamilia(cod, nome, categoriaId, subcategoriaId) {
        if (!cod && !nome) return null;
        let fam = porCodigo(familias, cod);
        if (!fam && nome) {
          fam = familias.find((x) => normaliza(x.descricao) === normaliza(nome)
            && x.subcategoria_id === subcategoriaId) || null;
        }
        if (fam) return fam;
        if (!cod) return null;
        try {
          fam = await criar('arm_familias', {
            descricao: nome || `Família ${cod}`,
            codigo_auxiliar: cod,
            categoria_id: categoriaId,
            subcategoria_id: subcategoriaId,
          });
          familias.push(fam);
          criadasFam += 1;
          return fam;
        } catch (e) {
          erros.push(`família ${cod}: ${traduzErro(e)}`);
          return null;
        }
      }

      // SKUs que já existem (para separar inseridos de atualizados)
      const existentes = await listar('produtos', { select: 'sku' });
      const skus = new Set(existentes.map((p) => String(p.sku).trim().toUpperCase()));

      botao.textContent = 'Importando…';

      const linhas = [];
      for (const linha of bruto) {
        const sku = String(linha[mapa.sku] ?? '').trim();
        const ean = String(linha[mapa.ean] ?? '').trim();
        const descricao = String(linha[mapa.descricao] ?? '').trim();
        if (!sku && !ean && !descricao) continue;

        if (!sku) { erros.push('linha sem SKU'); continue; }
        if (!descricao) { erros.push(`${sku}: sem descrição`); continue; }
        if (!ean) { erros.push(`${sku}: EAN obrigatório`); continue; }

        const codCat = mapa.catCodigo ? String(linha[mapa.catCodigo] ?? '').trim() : '';
        const nomeCat = mapa.catDescricao ? String(linha[mapa.catDescricao] ?? '').trim() : '';
        const codSub = mapa.subCodigo ? String(linha[mapa.subCodigo] ?? '').trim() : '';
        const nomeSub = mapa.subDescricao ? String(linha[mapa.subDescricao] ?? '').trim() : '';
        const codFam = mapa.famCodigo ? String(linha[mapa.famCodigo] ?? '').trim() : '';
        const nomeFam = mapa.famDescricao ? String(linha[mapa.famDescricao] ?? '').trim() : '';

        const cat = await garantirCategoria(codCat, nomeCat);
        const sub = cat ? await garantirSubcategoria(codSub, nomeSub, cat.id) : null;
        const fam = sub ? await garantirFamilia(codFam, nomeFam, cat.id, sub.id) : null;

        linhas.push({
          sku,
          ean,
          descricao,
          unidade: mapa.unidade ? String(linha[mapa.unidade] ?? '').trim() || 'UN' : 'UN',
          categoria_id: cat ? cat.id : null,
          subcategoria_id: sub ? sub.id : null,
          familia_id: fam ? fam.id : null,
          origem: 'importacao',
        });
      }

      let inseridos = 0;
      let atualizados = 0;
      const TAMANHO = 150;

      for (let i = 0; i < linhas.length; i += TAMANHO) {
        const lote = linhas.slice(i, i + TAMANHO);
        const { error } = await sb.from('produtos').upsert(lote, { onConflict: 'sku' });
        if (!error) {
          for (const p of lote) {
            if (skus.has(String(p.sku).trim().toUpperCase())) atualizados += 1;
            else { inseridos += 1; skus.add(String(p.sku).trim().toUpperCase()); }
          }
          continue;
        }
        // lote rejeitado: tenta linha por linha para apontar o problema
        for (const p of lote) {
          const { error: erroLinha } = await sb.from('produtos').upsert([p], { onConflict: 'sku' });
          if (erroLinha) erros.push(`${p.sku}: ${traduzErro(erroLinha)}`);
          else if (skus.has(String(p.sku).trim().toUpperCase())) atualizados += 1;
          else { inseridos += 1; skus.add(String(p.sku).trim().toUpperCase()); }
        }
      }

      corpo.querySelector('#resultado').innerHTML = `
        <div class="cartao" style="box-shadow:none;margin-top:14px">
          <h3>Resultado</h3>
          <p><strong>${inseridos}</strong> produto(s) novo(s) e
             <strong>${atualizados}</strong> atualizado(s).</p>
          ${criadasCat + criadasSub + criadasFam ? `<p class="sub">
            ${criadasCat} categoria(s), ${criadasSub} subcategoria(s) e ${criadasFam} família(s) criadas.</p>` : ''}
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
