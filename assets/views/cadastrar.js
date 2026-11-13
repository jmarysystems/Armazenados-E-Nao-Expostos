// Tela da loja: colar as duas listas e gerar o relatório.
import { listar, rpc } from '../api.js';
import * as ui from '../ui.js';
import { imprimirPeriodo } from './relatorios.js';

const hojeISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export async function render(raiz, ctx, lojaId) {
  if (!lojaId) {
    raiz.innerHTML = ui.vazio('Loja não informada.');
    return;
  }
  const loja = (await listar('arm_lojas', { eq: { id: lojaId } }))[0];
  if (!loja) {
    raiz.innerHTML = ui.vazio('Loja não encontrada ou sem acesso.');
    return;
  }

  raiz.innerHTML = `
    <h2 class="titulo-pagina">${ui.esc(loja.nome)}</h2>
    <div class="cartao">
      <div class="cartao-topo">
        <a class="botao botao-pequeno" href="#/lojas">← Voltar</a>
        <span class="sub">Armazenados e Não Expostos</span>
      </div>
      <h3 style="text-align:center">Preencha os Códigos nas listas</h3>
      <div class="grade grade-2">
        <label class="campo"><span>Armazenados e Não Expostos</span>
          <textarea name="deposito" rows="10" placeholder="EAN ou SKU, um por linha"></textarea></label>
        <label class="campo"><span>Listagem Total Auditada</span>
          <textarea name="auditada" rows="10" placeholder="EAN ou SKU, um por linha"></textarea></label>
      </div>
      <div class="linha-acoes" style="justify-content:center;margin-top:8px">
        <button type="button" class="botao-azul" id="verificar">Verificar</button>
        <button type="button" class="botao-primario" id="enviar">Enviar</button>
      </div>
      <div id="resultado"></div>
    </div>`;

  const deposito = raiz.querySelector('textarea[name="deposito"]');
  const auditada = raiz.querySelector('textarea[name="auditada"]');
  const saida = raiz.querySelector('#resultado');

  function mostrarFaltantes(rotulo, lista) {
    if (!lista.length) return '';
    return `<div class="erro"><strong>${ui.esc(rotulo)}:</strong> ${lista.length} código(s) sem produto cadastrado —
      ${ui.esc(lista.join(', '))}. Cadastre em <a href="#/produtos">Produtos</a> ou retire da lista.</div>`;
  }

  raiz.querySelector('#verificar').addEventListener('click', async (ev) => {
    ev.target.disabled = true;
    ev.target.textContent = 'Verificando…';
    try {
      const dep = await rpc('arm_verificar_codigos', { p_codigos: deposito.value });
      const aud = await rpc('arm_verificar_codigos', { p_codigos: auditada.value });

      saida.innerHTML = `
        <div class="aviso">
          <strong>Armazenados:</strong> ${dep.total - dep.faltantes.length} encontrado(s)${dep.faltantes.length ? `, ${dep.faltantes.length} faltando` : ''}<br>
          <strong>Auditada:</strong> ${aud.total - aud.faltantes.length} encontrado(s)${aud.faltantes.length ? `, ${aud.faltantes.length} faltando` : ''}
        </div>
        ${mostrarFaltantes('Armazenados e Não Expostos', dep.faltantes)}
        ${mostrarFaltantes('Listagem Total Auditada', aud.faltantes)}`;
    } catch (erro) {
      saida.innerHTML = `<div class="erro">${ui.esc(erro.message)}</div>`;
    } finally {
      ev.target.disabled = false;
      ev.target.textContent = 'Verificar';
    }
  });

  raiz.querySelector('#enviar').addEventListener('click', async (ev) => {
    if (!deposito.value.trim()) return ui.toast('Preencha a lista Armazenados e Não Expostos.', 'erro');
    if (!auditada.value.trim()) return ui.toast('Preencha a Listagem Total Auditada.', 'erro');

    ev.target.disabled = true;
    ev.target.textContent = 'Gerando…';
    try {
      const res = await rpc('arm_processar_auditoria', {
        p_loja_id: loja.id,
        p_codigos_deposito: deposito.value,
        p_codigos_auditados: auditada.value,
      });

      if (!res.ok) {
        saida.innerHTML = mostrarFaltantes('Armazenados e Não Expostos', res.faltantes_deposito || [])
          + mostrarFaltantes('Listagem Total Auditada', res.faltantes_auditados || []);
        ui.toast('Existem códigos sem cadastro. Nada foi gravado.', 'erro');
        return;
      }

      deposito.value = '';
      auditada.value = '';
      saida.innerHTML = `
        <div class="aviso">
          Relatório gerado: <strong>${res.qtd_deposito}</strong> no depósito ·
          <strong>${res.qtd_auditada}</strong> auditados ·
          <strong>${ui.pct(res.percentual)}</strong>.
        </div>
        <div class="linha-acoes" style="justify-content:center">
          <button type="button" class="botao-azul" id="imprimir">Imprimir relatório</button>
          <a class="botao" href="#/relatorios">Ver relatórios</a>
        </div>`;

      saida.querySelector('#imprimir').addEventListener('click', () => {
        imprimirPeriodo(loja.id, hojeISO(), hojeISO(), loja.nome);
      });
      ui.toast('Auditoria registrada.');
    } catch (erro) {
      saida.innerHTML = `<div class="erro">${ui.esc(erro.message)}</div>`;
    } finally {
      ev.target.disabled = false;
      ev.target.textContent = 'Enviar';
    }
  });
}
