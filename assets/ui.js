// Helpers de interface.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const num = (v, casas = 0) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

export const pct = (v) => `${num(v, 2)}%`;

export function dataBR(v) {
  if (!v) return '—';
  const s = String(v);
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export function dataHoraBR(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function toast(mensagem, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = mensagem;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('sair'), 3600);
  setTimeout(() => el.remove(), 4200);
}

export function modal({ titulo, corpo, largura = '560px' }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:${esc(largura)}">
      <header class="modal-topo"><h2>${esc(titulo)}</h2>
        <button type="button" class="fechar" aria-label="Fechar">&times;</button></header>
      <div class="modal-corpo">${corpo}</div>
    </div>`;
  const fechar = () => overlay.remove();
  overlay.querySelector('.fechar').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
  document.body.appendChild(overlay);
  return { overlay, fechar, corpo: overlay.querySelector('.modal-corpo') };
}

export const vazio = (msg) => `<p class="vazio">${esc(msg)}</p>`;

export function campoTexto(rotulo, nome, valor = '', opcoes = {}) {
  return `
    <label class="campo">
      <span>${esc(rotulo)}${opcoes.obrigatorio ? ' *' : ''}</span>
      <input type="${esc(opcoes.tipo || 'text')}" name="${esc(nome)}" value="${esc(valor ?? '')}"
             ${opcoes.obrigatorio ? 'required' : ''}
             ${opcoes.placeholder ? `placeholder="${esc(opcoes.placeholder)}"` : ''}>
    </label>`;
}

export function campoSelect(rotulo, nome, opcoes, valorAtual, extra = {}) {
  const opts = opcoes.map((o) => `<option value="${esc(o.valor)}" ${
    String(o.valor) === String(valorAtual ?? '') ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('');
  return `
    <label class="campo">
      <span>${esc(rotulo)}${extra.obrigatorio ? ' *' : ''}</span>
      <select name="${esc(nome)}" ${extra.obrigatorio ? 'required' : ''}>
        ${extra.vazio ? `<option value="">${esc(extra.vazio)}</option>` : ''}${opts}
      </select>
    </label>`;
}

export function dadosDoForm(form) {
  const dados = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    dados[el.name] = el.value?.trim?.() ?? el.value;
  }
  return dados;
}
