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
          ${ui.campoTexto('Código auxiliar', 'codigo_auxiliar', registro?.codigo_auxiliar || '', { placeholder: 'opcional' })}
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
    const colunasPai = cfg.pais.map((p) => p.rotulo).join(', ');
    const { fechar, corpo } = ui.modal({
      titulo: `Importar ${cfg.titulo.toLowerCase()}`,
      largura: '620px',
      corpo: `
        <p class="sub">Planilha com as colunas <strong>Código auxiliar</strong> (opcional),
        <strong>Descrição</strong>${colunasPai ? ` e <strong>${ui.esc(colunasPai)}</strong>` : ''}.
        Aceita .xlsx, .xls e .csv.</p>
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
          if (n === 'descricao' || n.startsWith('descri')) mapa.descricao = col;
          else if (['codigo auxiliar', 'codigo', 'cod'].includes(n)) mapa.codigo = col;
          else if (n === 'categoria') mapa.categoria = col;
          else if (n === 'subcategoria') mapa.subcategoria = col;
        }
        if (!mapa.descricao) throw new Error('Não encontrei a coluna "Descrição".');

        const acharPai = (tabela, nome) => {
          if (!nome) return null;
          const achado = listaPais[tabela].find((x) => normaliza(x.descricao) === normaliza(nome));
          return achado ? achado.id : null;
        };

        let inseridos = 0;
        const erros = [];

        for (const linha of bruto) {
          const descricao = String(linha[mapa.descricao] ?? '').trim();
          if (!descricao) continue;

          const values = {
            descricao,
            codigo_auxiliar: mapa.codigo ? String(linha[mapa.codigo] ?? '').trim() || null : null,
          };

          if (chave !== 'categorias') {
            const pai = acharPai('arm_categorias', String(linha[mapa.categoria] ?? '').trim());
            if (!pai) { erros.push(`${descricao}: categoria não encontrada`); continue; }
            values.categoria_id = pai;
          }
          if (chave === 'familias') {
            const sub = String(linha[mapa.subcategoria] ?? '').trim();
            const achada = listaPais.arm_subcategorias.find((x) => normaliza(x.descricao) === normaliza(sub));
            if (!achada) { erros.push(`${descricao}: subcategoria não encontrada`); continue; }
            values.subcategoria_id = achada.id;
          }

          const { error } = await sb.from(cfg.tabela).insert(values);
          if (error) erros.push(`${descricao}: ${traduzErro(error)}`);
          else inseridos += 1;
        }

        corpo.querySelector('#resultado').innerHTML = `
          <div class="cartao" style="box-shadow:none;margin-top:14px">
            <h3>Resultado</h3>
            <p><strong>${inseridos}</strong> registro(s) importado(s).</p>
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
