// Relatórios: por dia, por período e por loja (holding) + impressão e envio.
import { listar, rpc } from '../api.js?v=20261116b';
import * as ui from '../ui.js?v=20261116b';

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
    <div class="tabela-rolagem"><table>
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
    </table></div>`;
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
          <td class="barra-cel"><div class="barra-progresso" style="width:100%"></div></td>
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
        <button type="button" class="botao-primario" id="gmail">Gmail</button>
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
  return [
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
  ].join('\n');
}

// ---------------------------------------------------------------------
// Tela: abas com os campos e o botão Enviar dentro de cada uma
// ---------------------------------------------------------------------
export async function render(raiz, ctx) {
  ctx.setTitulo('Relatórios');

  const lojasTodas = await listar('arm_lojas', { ordem: 'nome' });
  const lojas = ctx.perfil.perfil === 'admin'
    ? lojasTodas
    : lojasTodas.filter((l) => l.id === ctx.perfil.loja_id);
  const opcoesLoja = lojas.map((l) => ({ valor: l.id, rotulo: l.nome }));
  const primeira = opcoesLoja[0]?.valor || '';

  raiz.innerHTML = `
    <div class="cartao">
      <div class="abas">
        <button type="button" class="aba" data-aba="periodo">Por Período</button>
        <button type="button" class="aba ativa" data-aba="dia">Por Dia</button>
        <button type="button" class="aba" data-aba="loja">Por Loja</button>
      </div>

      <section data-painel="periodo" hidden>
        <div class="grade grade-3">
          ${ui.campoSelect('Loja', 'lojaPeriodo', opcoesLoja, primeira, { vazio: '—' })}
          ${ui.campoTexto('Data Inicial', 'inicio', primeiroDiaDoAno(), { tipo: 'date' })}
          ${ui.campoTexto('Data Final', 'fim', hojeISO(), { tipo: 'date' })}
        </div>
        <div class="linha-acoes"><button type="button" class="botao-primario" data-enviar="periodo">Enviar</button></div>
        <div data-saida="periodo"></div>
      </section>

      <section data-painel="dia">
        <div class="grade grade-2">
          ${ui.campoSelect('Loja', 'lojaDia', opcoesLoja, primeira, { vazio: '—' })}
          ${ui.campoTexto('Data', 'dataDia', hojeISO(), { tipo: 'date' })}
        </div>
        <div class="linha-acoes">
          <button type="button" class="botao-primario" data-enviar="dia">Enviar</button>
          <button type="button" class="botao" data-enviar="ultimos">Últimos 10</button>
        </div>
        <div data-saida="dia"></div>
      </section>

      <section data-painel="loja" hidden>
        <div class="grade grade-2">
          ${ui.campoTexto('Data Inicial', 'inicioLoja', primeiroDiaDoAno(), { tipo: 'date' })}
          ${ui.campoTexto('Data Final', 'fimLoja', hojeISO(), { tipo: 'date' })}
        </div>
        <div class="linha-acoes"><button type="button" class="botao-primario" data-enviar="loja">Enviar</button></div>
        <div data-saida="loja"></div>
      </section>
    </div>`;

  const campo = (nome) => raiz.querySelector(`[name="${nome}"]`);
  const saida = (aba) => raiz.querySelector(`[data-saida="${aba}"]`);

  // ---------- abas ----------
  for (const b of raiz.querySelectorAll('[data-aba]')) {
    b.addEventListener('click', () => {
      const nova = b.dataset.aba;
      raiz.querySelectorAll('[data-aba]').forEach((x) => x.classList.toggle('ativa', x === b));
      raiz.querySelectorAll('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== nova; });
    });
  }

  // ---------- Por período ----------
  async function consultarPeriodo() {
    const alvo = saida('periodo');
    alvo.innerHTML = '<div class="carregando">Consultando…</div>';
    try {
      const d = await rpc('arm_relatorio_periodo', {
        p_loja_id: campo('lojaPeriodo').value,
        p_inicio: campo('inicio').value,
        p_fim: campo('fim').value,
      });
      alvo.innerHTML = `
        <h3 style="text-align:center">${ui.esc(d.loja || '')}</h3>
        ${tabelaTotais(d.totais, d.categorias, true)}
        <h3 style="text-align:center;margin-top:14px">Produtos Armazenados e Não Expostos</h3>
        ${tabelaItens(d.itens)}
        <div class="linha-acoes" style="margin-top:14px;justify-content:center">
          <button type="button" class="botao-azul" id="imprimir-periodo">Imprimir</button>
          <button type="button" class="botao" id="email-periodo">Enviar por e-mail</button>
        </div>`;
      alvo.querySelector('#imprimir-periodo').addEventListener('click', () =>
        imprimirPeriodo(campo('lojaPeriodo').value, campo('inicio').value, campo('fim').value, d.loja));
      alvo.querySelector('#email-periodo').addEventListener('click', () =>
        modalEmail('Relatório Armazenados e Não Expostos', textoDoPeriodo(d)));
    } catch (erro) {
      alvo.innerHTML = `<div class="erro">${ui.esc(erro.message)}</div>`;
    }
  }

  // ---------- Lista de auditorias ----------
  const isoDoDia = (v) => {
    const d = new Date(v);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  function tabelaAuditorias(rows) {
    return `
      <div class="tabela-rolagem"><table>
        <thead><tr><th>RELATÓRIO</th><th>ID</th><th>DATA CADASTRO</th><th>LOJA</th>
          <th class="num">QTD ITENS AUDITADOS</th><th>AUDITOR</th><th>ENVIADO EMAIL</th></tr></thead>
        <tbody>
          ${rows.map((a) => `<tr data-loja="${ui.esc(a.loja)}" data-dia="${ui.esc(isoDoDia(a.data_cadastro))}">
            <td><button type="button" class="botao-pequeno botao-primario"
                 data-abrir="${ui.esc(a.id)}">ABRIR</button></td>
            <td class="mono">${ui.esc(a.id.slice(0, 8))}</td>
            <td>${ui.dataHoraBR(a.data_cadastro)}</td>
            <td>${ui.esc(a.loja)}</td>
            <td class="num">${ui.num(a.qtd_auditada)}</td>
            <td>${ui.esc(a.remetente)}</td>
            <td>${a.enviado_email ? 'SIM' : 'NÃO'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  function ligarAbrir(alvo) {
    for (const b of alvo.querySelectorAll('[data-abrir]')) {
      const tr = b.closest('tr');
      b.addEventListener('click', () => {
        const loja = lojas.find((l) => l.nome === tr.dataset.loja);
        imprimirPeriodo(loja?.id || '', tr.dataset.dia, tr.dataset.dia, tr.dataset.loja);
      });
    }
  }

  // ---------- Por dia ----------
  async function consultarDia() {
    const alvo = saida('dia');
    alvo.innerHTML = '<div class="carregando">Consultando…</div>';
    try {
      const d = await rpc('arm_relatorio_dia', {
        p_loja_id: campo('lojaDia').value,
        p_data: campo('dataDia').value,
      });
      const nomeLoja = lojas.find((l) => l.id === campo('lojaDia').value)?.nome || '';

      if (!d.auditorias.length) {
        alvo.innerHTML = `<h3 style="text-align:center">${ui.esc(nomeLoja)}</h3>`
          + ui.vazio('Nenhuma auditoria neste dia.');
        return;
      }

      alvo.innerHTML = `
        <h3 style="text-align:center">${ui.esc(nomeLoja)} — ${ui.dataBR(campo('dataDia').value)}</h3>
        ${tabelaAuditorias(d.auditorias)}`;
      ligarAbrir(alvo);
    } catch (erro) {
      alvo.innerHTML = `<div class="erro">${ui.esc(erro.message)}</div>`;
    }
  }

  // ---------- Últimos 10 ----------
  async function consultarUltimos() {
    const alvo = saida('dia');
    alvo.innerHTML = '<div class="carregando">Consultando…</div>';
    try {
      const d = await rpc('arm_relatorio_ultimos', { p_limite: 10 });
      if (!d.auditorias.length) {
        alvo.innerHTML = ui.vazio('Nenhuma auditoria registrada ainda.');
        return;
      }
      alvo.innerHTML = `
        <h3 style="text-align:center">Últimos ${d.auditorias.length} relatórios</h3>
        ${tabelaAuditorias(d.auditorias)}`;
      ligarAbrir(alvo);
    } catch (erro) {
      alvo.innerHTML = `<div class="erro">${ui.esc(erro.message)}</div>`;
    }
  }

  // ---------- Por loja ----------
  async function consultarLoja() {
    const alvo = saida('loja');
    alvo.innerHTML = '<div class="carregando">Consultando…</div>';
    try {
      const d = await rpc('arm_relatorio_por_loja', {
        p_inicio: campo('inicioLoja').value,
        p_fim: campo('fimLoja').value,
      });
      const max = Math.max(...d.lojas.map((l) => l.qtd_deposito), 1);

      alvo.innerHTML = `
        <h3 style="text-align:center">POR LOJA - HOLDING</h3>
        <div class="tabela-rolagem"><table>
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
        </table></div>
        <div class="linha-acoes" style="margin-top:14px;justify-content:center">
          <button type="button" class="botao-azul" id="imprimir-loja">Imprimir</button>
        </div>`;
      alvo.querySelector('#imprimir-loja').addEventListener('click', () =>
        imprimirPorLoja(campo('inicioLoja').value, campo('fimLoja').value));
    } catch (erro) {
      alvo.innerHTML = `<div class="erro">${ui.esc(erro.message)}</div>`;
    }
  }

  // ---------- botões Enviar ----------
  const enviar = {
    periodo: consultarPeriodo,
    dia: consultarDia,
    loja: consultarLoja,
    ultimos: consultarUltimos,
  };

  for (const b of raiz.querySelectorAll('[data-enviar]')) {
    b.addEventListener('click', async () => {
      b.disabled = true;
      b.textContent = 'Consultando…';
      try { await enviar[b.dataset.enviar](); }
      finally { b.disabled = false; b.textContent = 'Enviar'; }
    });
  }

  consultarUltimos();
}
