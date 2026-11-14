// Relatórios: por dia, por período e por loja (holding) + impressão e envio.
import { listar, rpc } from '../api.js';
import * as ui from '../ui.js';

const hojeISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const primeiroDiaDoAno = () => `${new Date().getFullYear()}-01-01`;

// ---------------------------------------------------------------------
// Blocos reutilizáveis
// ---------------------------------------------------------------------
function tabelaTotais(totais, categorias, comCategorias) {
  const max = Math.max(totais.qtd_deposito, ...(categorias || []).map((c) => c.qtd_deposito), 1);
  const barra = (v) => `<div class="barra-progresso" style="width:${Math.max(2, Math.round(v / max * 100))}%"></div>`;

  const linhas = (categorias || []).map((c) => `
    <tr>
      <td><strong>${ui.esc(c.categoria)}</strong></td>
      <td class="num">${ui.num(c.qtd_deposito)}</td>
      <td class="num">${ui.pct(c.percentual)}</td>
      <td class="barra-cel">${barra(c.qtd_deposito)}</td>
      <td class="num">${ui.num(c.qtd_auditada)}</td>
    </tr>`).join('');

  return `
    <table class="totais">
      <thead><tr>
        <th></th><th>QTD ITENS<br>NO DEPÓSITO</th><th>%<br>DEPÓSITO</th><th></th><th>QTD ITENS<br>AUDITADOS</th>
      </tr></thead>
      <tbody>
        <tr>
          <td><strong>TOTAIS →</strong></td>
          <td class="num">${ui.num(totais.qtd_deposito)}</td>
          <td class="num">${ui.pct(totais.percentual)}</td>
          <td class="barra-cel">${barra(totais.qtd_deposito)}</td>
          <td class="num">${ui.num(totais.qtd_auditada)}</td>
        </tr>
        ${comCategorias ? linhas : ''}
      </tbody>
    </table>`;
}

function tabelaItens(itens) {
  if (!itens.length) return ui.vazio('Nenhum item no período.');
  return `
    <table>
      <thead><tr>
        <th>DATA DO CADASTRO</th><th>DESCRIÇÃO_DO_PRODUTO</th><th>EAN</th><th>SKU</th>
        <th>CATEGORIA</th><th>AUDITOR</th>
      </tr></thead>
      <tbody>
        ${itens.map((i) => `<tr>
          <td>${ui.dataHoraBR(i.data_cadastro)}</td>
          <td>${ui.esc(i.descricao)}</td>
          <td class="mono">${ui.esc(i.ean || '')}</td>
          <td class="mono">${ui.esc(i.sku || '')}</td>
          <td>${ui.esc(i.categoria || '')}</td>
          <td>${ui.esc(i.auditor || '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function cabecalhoImpressao(titulo, subtitulo, periodo) {
  return `
    <div class="print-cabecalho">
      <div class="logo-print"></div>
      <div class="titulo">
        <h1>${ui.esc(titulo)}</h1>
        <h2>${ui.esc(subtitulo)}</h2>
      </div>
    </div>
    <div class="print-periodo">PERÍODO: ${ui.esc(periodo)}</div>`;
}

function imprimir(html) {
  document.querySelectorAll('.area-impressao').forEach((n) => n.remove());
  const el = document.createElement('div');
  el.className = 'area-impressao';
  el.innerHTML = html;
  document.body.appendChild(el);
  window.addEventListener('afterprint', () => el.remove(), { once: true });
  window.print();
}

// ---------------------------------------------------------------------
// Impressão: período (por loja e por categoria, com os itens)
// ---------------------------------------------------------------------
export async function imprimirPeriodo(lojaId, inicio, fim, nomeLoja) {
  const d = await rpc('arm_relatorio_periodo', { p_loja_id: lojaId, p_inicio: inicio, p_fim: fim });
  imprimir(`
    ${cabecalhoImpressao('Armazenados e Não Expostos',
      `${d.loja || nomeLoja || ''} Gerenciamento`,
      `${ui.dataBR(inicio)} a ${ui.dataBR(fim)}`)}
    ${tabelaTotais(d.totais, d.categorias, true)}
    <h3 style="text-align:center;margin-top:18px">Produtos Armazenados e Não Expostos</h3>
    ${tabelaItens(d.itens)}
    <div class="print-assinaturas">
      <div>Assinatura/Gerente</div>
      <div>Assinatura/Prevenção</div>
    </div>`);
}

// ---------------------------------------------------------------------
// Impressão: por loja (holding)
// ---------------------------------------------------------------------
export async function imprimirPorLoja(inicio, fim) {
  const d = await rpc('arm_relatorio_por_loja', { p_inicio: inicio, p_fim: fim });
  const max = Math.max(...d.lojas.map((l) => l.qtd_deposito), 1);

  const linhas = d.lojas.map((l) => `
    <tr>
      <td><strong>${ui.esc(l.loja)}</strong></td>
      <td class="num">${ui.num(l.qtd_deposito)}</td>
      <td class="num">${ui.pct(l.percentual)}</td>
      <td class="barra-cel"><div class="barra-progresso"
        style="width:${Math.max(2, Math.round(l.qtd_deposito / max * 100))}%"></div></td>
      <td class="num">${ui.num(l.qtd_auditada)}</td>
    </tr>`).join('');

  imprimir(`
    ${cabecalhoImpressao('Armazenados e Não Expostos', 'POR LOJA - HOLDING',
      `${ui.dataBR(inicio)} a ${ui.dataBR(fim)}`)}
    <table class="totais">
      <thead><tr>
        <th></th><th>QTD ITENS<br>NO DEPÓSITO</th><th>%<br>DEPÓSITO</th><th></th><th>QTD ITENS<br>AUDITADOS</th>
      </tr></thead>
      <tbody>
        <tr>
          <td><strong>TOTAIS →</strong></td>
          <td class="num">${ui.num(d.totais.qtd_deposito)}</td>
          <td class="num">${ui.pct(d.totais.percentual)}</td>
          <td class="barra-cel"><div class="barra-progresso"
            style="width:100%"></div></td>
          <td class="num">${ui.num(d.totais.qtd_auditada)}</td>
        </tr>
        ${linhas}
      </tbody>
    </table>
    <div class="print-assinaturas">
      <div>Assinatura/Gerente</div>
      <div>Assinatura/Prevenção</div>
    </div>`);
}

// ---------------------------------------------------------------------
// Envio por e-mail (Gmail/Outlook no navegador)
// ---------------------------------------------------------------------
function modalEmail(assunto, texto) {
  const { fechar, corpo } = ui.modal({
    titulo: 'Enviar relatório por e-mail',
    corpo: `
      <label class="campo"><span>E-mail do destinatário</span>
        <input type="email" id="destino" placeholder="gerencia@empresa.com"></label>
      <label class="campo"><span>Mensagem</span>
        <textarea id="texto" rows="10">${ui.esc(texto)}</textarea></label>
      <div class="linha-acoes">
        <button type="button" class="botao-azul" id="gmail">Gmail</button>
        <button type="button" class="botao" id="outlook">Outlook</button>
        <button type="button" class="botao" id="copiar">Copiar</button>
        <button type="button" class="botao" id="fechar">Fechar</button>
      </div>`,
  });

  const destino = corpo.querySelector('#destino');
  const msg = corpo.querySelector('#texto');

  const abrir = (base) => {
    const to = destino.value.trim();
    if (!to) { ui.toast('Informe o e-mail do destinatário.', 'erro'); return; }
    const p = base === 'gmail'
      ? new URLSearchParams({ view: 'cm', fs: '1', to, su: assunto, body: msg.value })
      : new URLSearchParams({ to, subject: assunto, body: msg.value });
    const url = base === 'gmail'
      ? `https://mail.google.com/mail/?${p}`
      : `https://outlook.office.com/mail/deeplink/compose?${p}`;
    window.open(url, '_blank', 'noopener');
  };

  corpo.querySelector('#gmail').addEventListener('click', () => abrir('gmail'));
  corpo.querySelector('#outlook').addEventListener('click', () => abrir('outlook'));
  corpo.querySelector('#copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(msg.value); ui.toast('Mensagem copiada.'); }
    catch { window.prompt('Copie:', msg.value); }
  });
  corpo.querySelector('#fechar').addEventListener('click', fechar);
}

function textoDoPeriodo(d) {
  const linhas = [
    `Relatório: Armazenados e Não Expostos — ${d.loja || ''}`,
    `Período: ${ui.dataBR(d.periodo.inicio)} a ${ui.dataBR(d.periodo.fim)}`,
    '',
    `Itens no depósito: ${d.totais.qtd_deposito}`,
    `Itens auditados: ${d.totais.qtd_auditada}`,
    `% depósito: ${ui.pct(d.totais.percentual)}`,
    '',
    'Por categoria:',
    ...d.categorias.map((c) => `• ${c.categoria}: ${c.qtd_deposito} no depósito / ${c.qtd_auditada} auditados (${ui.pct(c.percentual)})`),
    '',
    `Itens (${d.itens.length}):`,
    ...d.itens.map((i) => `• ${i.descricao} — EAN ${i.ean || '-'} · SKU ${i.sku || '-'} · ${i.categoria || '-'} · ${i.auditor || '-'}`),
  ];
  return linhas.join('\n');
}

// ---------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------
export async function render(raiz, ctx) {
  ctx.setTitulo('Relatórios');
  const lojasTodas = await listar('arm_lojas', { ordem: 'nome' });
  const lojas = ctx.perfil.perfil === 'admin'
    ? lojasTodas
    : lojasTodas.filter((l) => l.id === ctx.perfil.loja_id);

  const opcoesLoja = lojas.map((l) => ({ valor: l.id, rotulo: l.nome })).map((o) => o);

  raiz.innerHTML = `
    <h2 class="titulo-pagina">Relatórios</h2>
    <div class="cartao">
      <div class="abas">
        <button type="button" class="aba ativa" data-aba="periodo">Por Período</button>
        <button type="button" class="aba" data-aba="dia">Por Dia</button>
        <button type="button" class="aba" data-aba="loja">Por Loja</button>
      </div>
      <div class="grade grade-3" id="filtros-dia">
        ${ui.campoSelect('Loja', 'lojaDia', opcoesLoja, opcoesLoja[0]?.valor, { vazio: '—' })}
        ${ui.campoTexto('Data', 'dataDia', hojeISO(), { tipo: 'date' })}
      </div>
      <div class="grade grade-3" id="filtros-periodo" hidden>
        ${ui.campoSelect('Loja', 'lojaPeriodo', opcoesLoja, opcoesLoja[0]?.valor, { vazio: '—' })}
        ${ui.campoTexto('Data Inicial', 'inicio', primeiroDiaDoAno(), { tipo: 'date' })}
        ${ui.campoTexto('Data Final', 'fim', hojeISO(), { tipo: 'date' })}
      </div>
      <div class="grade grade-3" id="filtros-loja" hidden>
        ${ui.campoTexto('Data Inicial', 'inicioLoja', primeiroDiaDoAno(), { tipo: 'date' })}
        ${ui.campoTexto('Data Final', 'fimLoja', hojeISO(), { tipo: 'date' })}
      </div>
      <div id="saida"></div>
    </div>`;

  const saida = raiz.querySelector('#saida');
  let aba = 'periodo';

  const campos = (nome) => raiz.querySelector(`[name="${nome}"]`);

  function trocar(nova) {
    aba = nova;
    raiz.querySelector('#filtros-dia').hidden = nova !== 'dia';
    raiz.querySelector('#filtros-periodo').hidden = nova !== 'periodo';
    raiz.querySelector('#filtros-loja').hidden = nova !== 'loja';
    for (const b of raiz.querySelectorAll('[data-aba]')) {
      b.classList.toggle('ativa', b.dataset.aba === nova);
    }
    saida.innerHTML = '';
  }

  async function pesquisar() {
    saida.innerHTML = '<div class="carregando">Consultando…</div>';
    try {
      if (aba === 'dia') {
        const d = await rpc('arm_relatorio_dia', {
          p_loja_id: campos('lojaDia').value,
          p_data: campos('dataDia').value,
        });
        if (!d.auditorias.length) { saida.innerHTML = ui.vazio('Nenhuma auditoria neste dia.'); return; }
        saida.innerHTML = `
          <table>
            <thead><tr><th>RELATÓRIO</th><th>ID</th><th>DATA CADASTRO</th><th>LOJA</th>
              <th class="num">QTD ITENS AUDITADOS</th><th>AUDITOR</th><th>ENVIADO EMAIL</th></tr></thead>
            <tbody>
              ${d.auditorias.map((a) => `<tr>
                <td><button type="button" class="botao-pequeno botao-primario"
                     data-imprimir-dia="${ui.esc(a.id)}">ABRIR</button></td>
                <td>${ui.esc(a.id.slice(0, 8))}</td>
                <td>${ui.dataHoraBR(a.data_cadastro)}</td>
                <td>${ui.esc(a.loja)}</td>
                <td class="num">${ui.num(a.qtd_auditada)}</td>
                <td>${ui.esc(a.remetente)}</td>
                <td>${a.enviado_email ? 'SIM' : 'NÃO'}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
        for (const b of saida.querySelectorAll('[data-imprimir-dia]')) {
          b.addEventListener('click', () => imprimirPeriodo(campos('lojaDia').value,
            campos('dataDia').value, campos('dataDia').value,
            lojas.find((l) => l.id === campos('lojaDia').value)?.nome));
        }
        return;
      }

      if (aba === 'periodo') {
        const d = await rpc('arm_relatorio_periodo', {
          p_loja_id: campos('lojaPeriodo').value,
          p_inicio: campos('inicio').value,
          p_fim: campos('fim').value,
        });
        saida.innerHTML = `
          <h3 style="text-align:center">${ui.esc(d.loja || '')}</h3>
          ${tabelaTotais(d.totais, d.categorias, true)}
          <h3 style="text-align:center;margin-top:14px">Produtos Armazenados e Não Expostos</h3>
          ${tabelaItens(d.itens)}
          <div class="linha-acoes" style="margin-top:14px;justify-content:center">
            <button type="button" class="botao-azul" id="imprimir">Imprimir</button>
            <button type="button" class="botao" id="email">Enviar por e-mail</button>
          </div>`;
        saida.querySelector('#imprimir').addEventListener('click', () =>
          imprimirPeriodo(campos('lojaPeriodo').value, campos('inicio').value, campos('fim').value, d.loja));
        saida.querySelector('#email').addEventListener('click', () =>
          modalEmail('Relatório Armazenados e Não Expostos', textoDoPeriodo(d)));
        return;
      }

      const d = await rpc('arm_relatorio_por_loja', {
        p_inicio: campos('inicioLoja').value,
        p_fim: campos('fimLoja').value,
      });
      const max = Math.max(...d.lojas.map((l) => l.qtd_deposito), 1);
      saida.innerHTML = `
        <h3 style="text-align:center">POR LOJA - HOLDING</h3>
        <table>
          <thead><tr><th>LOJA</th><th class="num">QTD ITENS NO DEPÓSITO</th><th class="num">% DEPÓSITO</th>
            <th></th><th class="num">QTD ITENS AUDITADOS</th></tr></thead>
          <tbody>
            <tr><td><strong>TOTAIS →</strong></td>
              <td class="num">${ui.num(d.totais.qtd_deposito)}</td>
              <td class="num">${ui.pct(d.totais.percentual)}</td>
              <td class="barra-cel"><div class="barra-progresso" style="width:100%"></div></td>
              <td class="num">${ui.num(d.totais.qtd_auditada)}</td></tr>
            ${d.lojas.map((l) => `<tr>
              <td>${ui.esc(l.loja)}</td>
              <td class="num">${ui.num(l.qtd_deposito)}</td>
              <td class="num">${ui.pct(l.percentual)}</td>
              <td class="barra-cel"><div class="barra-progresso"
                style="width:${Math.max(2, Math.round(l.qtd_deposito / max * 100))}%"></div></td>
              <td class="num">${ui.num(l.qtd_auditada)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="linha-acoes" style="margin-top:14px;justify-content:center">
          <button type="button" class="botao-azul" id="imprimir">Imprimir</button>
        </div>`;
      saida.querySelector('#imprimir').addEventListener('click', () =>
        imprimirPorLoja(campos('inicioLoja').value, campos('fimLoja').value));
    } catch (erro) {
      saida.innerHTML = `<div class="erro">${ui.esc(erro.message)}</div>`;
    }
  }

  for (const b of raiz.querySelectorAll('[data-aba]')) {
    b.addEventListener('click', () => { trocar(b.dataset.aba); pesquisar(); });
  }

  trocar('periodo');
  pesquisar();
}
