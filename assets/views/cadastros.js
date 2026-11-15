// Categorias, subcategorias e famílias (mesmo padrão da tela de produtos).
import { listar, criar, atualizar, excluir, sb, traduzErro } from '../api.js';
import * as ui from '../ui.js';

const DEF = {
  categorias: {
    titulo: 'Categorias', singular: 'categoria', tabela: 'arm_categorias',
    pais: [],
  },
  subcategorias: {
    titulo: 'Subcategorias', singular: 'subcategoria', tabela: 'arm_subcategorias',
    pais: [{ campo: 'categoria_id', rotulo: 'Categoria', tabela: 'arm_categorias' }],
  },
  familias: {
    titulo: 'Famílias', singular: 'família', tabela: 'arm_familias',
    pais: [
      { campo: 'categoria_id', rotulo: 'Categoria', tabela: 'arm_categorias' },
      { campo: 'subcategoria_id', rotulo: 'Subcategoria', tabela: 'arm_subcategorias' },
    ],
  },
};

const normaliza = (s) => String(s ?? '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim();

export const categorias = (raiz, ctx) => render(raiz, ctx, 'categorias');
export const subcategorias = (raiz, ctx) => render(raiz, ctx, 'subcategorias');
export const familias = (raiz, ctx) => render(raiz, ctx, 'familias');

async function render(raiz, ctx, chave) {
  const cfg = DEF[chave];
  ctx.setTitulo(cfg.titulo);
  const podeEditar = ctx.perfil.perfil !== 'auditor';

  const listaPais = {};
  for (const p of cfg.pais) {
    listaPais[p.tabela] = await listar(p.tabela, { ordem: 'descricao' });
  }

  const select = ['*', ...cfg.pais.map((p) => `${p.tabela}(descricao)`)].join(', ');
  const dados = await listar(cfg.tabela, { select, ordem: 'descricao' });

  const nomePai = (linha, p) => linha[p.tabela]?.descricao || '—';

  const linhas = dados.map((d) => `
    <tr>
      <td class="mono">${ui.esc(d.codigo_auxiliar || '—')}</td>
      <td>${ui.esc(d.descricao)}</td>
      ${cfg.pais.map((p) => `<td>${ui.esc(nomePai(d, p))}</td>`).join('')}
      <td class="acoes">
        ${podeEditar ? `<button type="button" class="botao-pequeno" data-editar="${ui.esc(d.id)}">Editar</button>
        <button type="button" class="botao-pequeno botao-perigo" data-excluir="${ui.esc(d.id)}">Excluir</button>` : ''}
      </td>
    </tr>`).join('');

  raiz.innerHTML = `
    <div class="cartao">
      <div class="cartao-topo">
        <h2>${dados.length} ${ui.esc(cfg.singular)}(s)</h2>
        ${podeEditar ? `<div class="linha-acoes">
          <button type="button" id="importar">Importar arquivo</button>
          <button type="button" class="botao-primario" id="novo">Nova ${ui.esc(cfg.singular)}</button>
        </div>` : ''}
      </div>
      ${dados.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Código auxiliar</th><th>Descrição</th>
          ${cfg.pais.map((p) => `<th>${ui.esc(p.rotulo)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>` : ui.vazio(`Nenhuma ${cfg.singular} cadastrada.`)}
    </div>`;

  raiz.querySelector('#novo')?.addEventListener('click', () => modal(null));
  raiz.querySelector('#importar')?.addEventListener('click', () => modalImportar());

  function modal(registro) {
    const editando = !!registro;
    const camposPai = cfg.pais.map((p) => ui.campoSelect(
      p.rotulo, p.campo,
      listaPais[p.tabela].map((x) => ({ valor: x.id, rotulo: x.descricao })),
      registro?.[p.campo] || '', { obrigatorio: true, vazio: '—' })).join('');

    const { fechar, corpo } = ui.modal({
      titulo: editando ? `Editar ${cfg.singular}` : `Nova ${cfg.singular}`,
      corpo: `
        <form id="form" class="grade grade-2">
          ${ui.campoTexto('Código auxiliar', 'codigo_auxiliar', registro?.codigo_auxiliar || '', { placeholder: 'em branco = ID do registro' })}
          ${ui.campoTexto('Descrição', 'descricao', registro?.descricao || '', { obrigatorio: true })}
          ${camposPai}
          <div class="linha-acoes campo-largo">
            <button type="submit" class="botao-primario">${editando ? 'Salvar' : 'Criar'}</button>
            <button type="button" id="cancelar">Cancelar</button>
          </div>
        </form>`,
    });

    corpo.querySelector('#cancelar').addEventListener('click', fechar);
    corpo.querySelector('#form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = ui.dadosDoForm(ev.target);
      const values = {
        codigo_auxiliar: d.codigo_auxiliar || null,
        descricao: d.descricao,
      };
      for (const p of cfg.pais) values[p.campo] = d[p.campo] || null;
      try {
        if (editando) await atualizar(cfg.tabela, registro.id, values);
        else await criar(cfg.tabela, values);
        fechar();
        ui.toast(editando ? 'Registro atualizado.' : 'Registro criado.');
        ctx.recarregar();
      } catch (erro) { ui.toast(erro.message, 'erro'); }
    });
  }

  function modalImportar() {
    const instrucao = chave === 'categorias'
      ? '<strong>Código auxiliar</strong> (em branco = ID do registro) e <strong>Descrição</strong>'
      : chave === 'subcategorias'
        ? '<strong>Código auxiliar da categoria</strong>, <strong>Descrição da categoria</strong>, <strong>Código auxiliar da subcategoria</strong> e <strong>Descrição da subcategoria</strong>'
        : '<strong>Código auxiliar da categoria</strong>, <strong>Descrição da categoria</strong>, <strong>Código auxiliar da subcategoria</strong>, <strong>Descrição da subcategoria</strong>, <strong>Código auxiliar da família</strong> e <strong>Descrição da família</strong>';

    const { fechar, corpo } = ui.modal({
      titulo: `Importar ${cfg.titulo.toLowerCase()}`,
      largura: '620px',
      corpo: `
        <p class="sub">Planilha com as colunas ${instrucao}. Aceita .xlsx, .xls e .csv.
        ${chave !== 'categorias' ? 'A conferência é feita pelo código auxiliar: se a categoria ainda não existir, ela é criada com a descrição informada e a subcategoria é associada a ela.' : ''}</p>
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
          const ehCodigo = n.includes('codigo') || n.includes('cod ');
          const daCategoria = n.includes('categoria') && !n.includes('subcategoria');
          const daSub = n.includes('subcategoria');
          const ehDescricao = n.includes('descri') || n === 'nome';

          if (ehDescricao) {
            if (daCategoria) mapa.catDescricao = col;
            else if (daSub && chave === 'familias') mapa.subDescricao = col;
            else mapa.descricao = col;
          } else if (ehCodigo) {
            if (daCategoria) mapa.catCodigo = col;
            else if (daSub && chave === 'familias') mapa.subCodigo = col;
            else mapa.codigo = col;
          } else if (n === 'categoria') {
            mapa.catDescricao = col;
          } else if (n === 'subcategoria') {
            mapa.subDescricao = col;
          }
        }
        if (!mapa.descricao && chave === 'subcategorias') mapa.descricao = mapa.subDescricao;
        if (!mapa.descricao) throw new Error('Não encontrei a coluna "Descrição".');

        const porCodigo = (tabela, codigo) => {
          const alvo = normaliza(codigo);
          if (!alvo) return null;
          return listaPais[tabela].find((x) => normaliza(x.codigo_auxiliar) === alvo) || null;
        };

        let inseridos = 0;
        let categoriasCriadas = 0;
        const erros = [];

        for (const linha of bruto) {
          const descricao = String(linha[mapa.descricao] ?? '').trim();
          if (!descricao) continue;

          const codigoProprio = mapa.codigo ? String(linha[mapa.codigo] ?? '').trim() : '';
          const values = { descricao, codigo_auxiliar: codigoProprio || null };

          if (chave !== 'categorias') {
            const codCat = String(linha[mapa.catCodigo] ?? '').trim();
            const nomeCat = String(linha[mapa.catDescricao] ?? '').trim();

            let pai = codCat ? porCodigo('arm_categorias', codCat) : null;
            if (!pai && !codCat && nomeCat) {
              pai = listaPais.arm_categorias.find((x) => normaliza(x.descricao) === normaliza(nomeCat)) || null;
            }

            if (!pai) {
              if (!codCat) { erros.push(`${descricao}: informe o código auxiliar da categoria`); continue; }
              try {
                pai = await criar('arm_categorias', {
                  descricao: nomeCat || `Categoria ${codCat}`,
                  codigo_auxiliar: codCat,
                });
                listaPais.arm_categorias.push(pai);
                categoriasCriadas += 1;
              } catch (e) {
                erros.push(`${descricao}: categoria ${codCat} não criada — ${traduzErro(e)}`);
                continue;
              }
            }
            values.categoria_id = pai.id;
          }

          if (chave === 'familias') {
            const codSub = String(linha[mapa.subCodigo] ?? '').trim();
            const nomeSub = String(linha[mapa.subDescricao] ?? '').trim();

            let sub = codSub ? porCodigo('arm_subcategorias', codSub) : null;
            if (!sub && nomeSub) {
              sub = listaPais.arm_subcategorias.find((x) => normaliza(x.descricao) === normaliza(nomeSub)
                && x.categoria_id === values.categoria_id) || null;
            }
            if (!sub) {
              erros.push(`${descricao}: subcategoria ${codSub || nomeSub} não encontrada`);
              continue;
            }
            values.subcategoria_id = sub.id;
          }

          const jaExiste = dados.some((x) => normaliza(x.descricao) === normaliza(descricao)
            && cfg.pais.every((p) => x[p.campo] === values[p.campo]));
          if (jaExiste) { erros.push(`${descricao}: já existe`); continue; }

          const { error } = await sb.from(cfg.tabela).insert(values);
          if (error) erros.push(`${descricao}: ${traduzErro(error)}`);
          else inseridos += 1;
        }

        corpo.querySelector('#resultado').innerHTML = `
          <div class="cartao" style="box-shadow:none;margin-top:14px">
            <h3>Resultado</h3>
            <p><strong>${inseridos}</strong> registro(s) importado(s).</p>
            ${categoriasCriadas ? `<p class="sub">${categoriasCriadas} categoria(s) criada(s) automaticamente.</p>` : ''}
            ${erros.length ? `<div class="aviso">${erros.length} linha(s) ignorada(s):<br>
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

  for (const b of raiz.querySelectorAll('[data-editar]')) {
    b.addEventListener('click', () => modal(dados.find((x) => x.id === b.dataset.editar)));
  }
  for (const b of raiz.querySelectorAll('[data-excluir]')) {
    b.addEventListener('click', async () => {
      if (!window.confirm('Excluir este registro?')) return;
      try {
        await excluir(cfg.tabela, b.dataset.excluir);
        ui.toast('Registro excluído.');
        ctx.recarregar();
      } catch (erro) { ui.toast(erro.message, 'erro'); }
    });
  }
}
