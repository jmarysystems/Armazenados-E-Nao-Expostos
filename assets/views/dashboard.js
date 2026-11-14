// Dashboard: totais gerais, por loja e por categoria.
import { rpc } from '../api.js';
import * as ui from '../ui.js';

function barra(valor, maximo, cor = '') {
  const pct = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return `<div class="barra ${cor}"><div style="width:${pct}%"></div></div>`;
}

export async function render(raiz, ctx) {
  ctx.setTitulo('Dashboard');

  const d = await rpc('arm_dashboard', {});
  const { totais, por_loja: lojas, por_categoria: categorias } = d;

  const maxLoja = Math.max(...lojas.map((l) => l.qtd_deposito), 1);
  const maxCat = Math.max(...categorias.map((c) => c.qtd_deposito), 1);

  raiz.innerHTML = `
    <div class="kpis">
      <div class="kpi">
        <div class="rotulo">No depósito</div>
        <div class="valor">${ui.num(totais.qtd_deposito)}</div>
        <div class="detalhe">itens armazenados e não expostos</div>
      </div>
      <div class="kpi">
        <div class="rotulo">Auditados</div>
        <div class="valor">${ui.num(totais.qtd_auditada)}</div>
        <div class="detalhe">itens na listagem total auditada</div>
      </div>
      <div class="kpi">
        <div class="rotulo">% depósito</div>
        <div class="valor" style="color:var(--verde)">${ui.pct(totais.percentual)}</div>
        <div class="detalhe">depósito ÷ auditados</div>
      </div>
      <div class="kpi">
        <div class="rotulo">Lojas</div>
        <div class="valor">${lojas.length}</div>
        <div class="detalhe">${ctx.perfil.perfil === 'admin' ? 'todas as lojas' : 'sua loja'}</div>
      </div>
    </div>

    <div class="cartao">
      <h2>Resultado por loja</h2>
      ${lojas.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Loja</th><th class="num">No depósito</th><th class="num">Auditados</th>
          <th class="num">%</th><th></th></tr></thead>
        <tbody>
          ${lojas.map((l) => `<tr>
            <td>${ui.esc(l.loja)}</td>
            <td class="num">${ui.num(l.qtd_deposito)}</td>
            <td class="num">${ui.num(l.qtd_auditada)}</td>
            <td class="num">${ui.pct(l.percentual)}</td>
            <td style="width:180px">${barra(l.qtd_deposito, maxLoja, 'verde')}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <th>Total</th>
          <th class="num">${ui.num(totais.qtd_deposito)}</th>
          <th class="num">${ui.num(totais.qtd_auditada)}</th>
          <th class="num">${ui.pct(totais.percentual)}</th>
          <th></th>
        </tr></tfoot>
      </table></div>` : ui.vazio('Nenhuma loja com auditoria.')}
    </div>

    <div class="cartao">
      <h2>Resultado por categoria</h2>
      ${categorias.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Categoria</th><th class="num">No depósito</th><th class="num">Auditados</th>
          <th class="num">%</th><th></th></tr></thead>
        <tbody>
          ${categorias.map((c) => `<tr>
            <td>${ui.esc(c.categoria)}</td>
            <td class="num">${ui.num(c.qtd_deposito)}</td>
            <td class="num">${ui.num(c.qtd_auditada)}</td>
            <td class="num">${ui.pct(c.percentual)}</td>
            <td style="width:180px">${barra(c.qtd_deposito, maxCat)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <th>Total</th>
          <th class="num">${ui.num(totais.qtd_deposito)}</th>
          <th class="num">${ui.num(totais.qtd_auditada)}</th>
          <th class="num">${ui.pct(totais.percentual)}</th>
          <th></th>
        </tr></tfoot>
      </table></div>` : ui.vazio('Nenhuma auditoria registrada ainda.')}
    </div>`;
}
