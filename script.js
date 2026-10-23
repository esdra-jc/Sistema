'use strict';
/* ===== Dados (localStorage) ===== */
const KEY = 'bobinatrack_v1';
const SIT = ['Armazenada', 'Em trânsito', 'Em uso', 'Bloqueada'];
let db = { bobinas: [], hist: [], div: [], cfg: { empresa: '', unidade: '', prazo: 30 } };
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const find = id => db.bobinas.find(b => b.id === id);
const loc = o => [o.galpao, o.setor, o.corredor, o.posicao].filter(Boolean).join(' / ');
const fmt = d => (d ? new Date(d).toLocaleString('pt-BR') : '—');
const getData = f => Object.fromEntries(new FormData(f));

function load() {
  try {
    const r = localStorage.getItem(KEY);
    if (r) { const o = JSON.parse(r); db = { ...db, ...o, cfg: { ...db.cfg, ...o.cfg } }; }
  } catch (e) { toast('Erro ao ler dados salvos.', 1); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Erro ao salvar (armazenamento cheio?).', 1); }
}
let tt;
function toast(m, err) {
  const t = $('#toast'); t.textContent = m; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(tt); tt = setTimeout(() => (t.className = ''), 2800);
}

/* ===== Helpers de interface (sempre textContent, nunca innerHTML com dados) ===== */
function mk(form, spec) {
  spec.forEach(([n, l, t, r, o]) => {
    const lb = document.createElement('label'); lb.append(l + (r ? ' *' : ''));
    let i;
    if (t === 'sel') { i = document.createElement('select'); (o || []).forEach(x => i.add(new Option(Array.isArray(x) ? x[1] : x, Array.isArray(x) ? x[0] : x))); }
    else if (t === 'area') i = document.createElement('textarea');
    else { i = document.createElement('input'); i.type = t || 'text'; if (t === 'number') { i.min = 0; i.step = 'any'; } }
    i.name = n; lb.append(i); form.append(lb);
  });
  const b = document.createElement('button'); b.type = 'submit'; b.textContent = 'Salvar'; b.className = 'ok'; form.append(b);
}
function tbl(heads, data, cols, acts) {
  const w = document.createElement('div'); w.className = 'tw';
  const t = document.createElement('table'); const hr = t.createTHead().insertRow();
  heads.concat(acts ? ['Ações'] : []).forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.append(th); });
  const tb = t.createTBody();
  if (!data.length) { const td = tb.insertRow().insertCell(); td.colSpan = heads.length + (acts ? 1 : 0); td.textContent = 'Nenhum registro.'; td.className = 'muted'; }
  data.forEach(r => {
    const tr = tb.insertRow(); cols.forEach(c => (tr.insertCell().textContent = c(r) ?? '—'));
    if (acts) { const td = tr.insertCell(); acts.forEach(([l, f, cls]) => { const b = document.createElement('button'); b.textContent = l; b.className = 'sm ' + (cls || ''); b.onclick = () => f(r); td.append(b); }); }
  });
  w.append(t); return w;
}
function btn(txt, fn, cls) { const b = document.createElement('button'); b.textContent = txt; b.className = cls || ''; b.onclick = fn; return b; }
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
function addHist(b, o, d, motivo, resp, obs, data) {
  const dt = data || new Date().toISOString();
  db.hist.push({ id: uid(), codigo: b.codigo, origem: o, destino: d, data: dt, resp, motivo, obs });
  b.ultimaMov = dt;
}
const ref = b => Math.max(...[b.ultimaMov, b.conferidaEm, b.criadoEm].filter(Boolean).map(Date.parse));
const stale = () => { const lim = Date.now() - db.cfg.prazo * 864e5; return db.bobinas.filter(b => ref(b) < lim); };
const pend = () => db.div.filter(d => d.status === 'Pendente');
function match(b, q) {
  q = q.trim().toLowerCase();
  return !q || [b.codigo, b.interno, b.lote, b.material, b.fornecedor, b.galpao, b.setor, b.corredor, b.posicao].some(v => (v || '').toLowerCase().includes(q));
}

/* ===== Navegação ===== */
const V = [['painel', 'Painel'], ['cadastro', 'Cadastrar bobina'], ['consulta', 'Consultar bobinas'], ['localizar', 'Localizar bobina'], ['mover', 'Registrar movimentação'], ['hist', 'Histórico'], ['alertas', 'Alertas e divergências'], ['relat', 'Relatórios'], ['config', 'Configurações']];
function show(v) {
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#side').classList.remove('open');
  if (R[v]) R[v]();
  window.scrollTo(0, 0);
}

/* ===== Renderização por tela ===== */
const R = {
  painel() {
    const bs = db.bobinas, hoje = new Date().toDateString();
    const gal = {}; bs.forEach(b => (gal[b.galpao] = (gal[b.galpao] || 0) + 1));
    const C = [['Total de bobinas', bs.length, ''], ['Peso total (kg)', bs.reduce((s, b) => s + (+b.peso || 0), 0).toLocaleString('pt-BR'), ''],
      ['Por galpão', Object.entries(gal).map(([g, n]) => g + ': ' + n).join(' · ') || '0', ''],
      ['Em trânsito', bs.filter(b => b.situacao === 'Em trânsito').length, 'w'], ['Localização desatualizada', stale().length, 'w'],
      ['Divergências pendentes', pend().length, 'd'], ['Movimentações hoje', db.hist.filter(h => new Date(h.data).toDateString() === hoje).length, 'ok']];
    const c = $('#cards'); c.replaceChildren();
    C.forEach(([l, v, k]) => { const d = document.createElement('div'); d.className = 'card ' + k; const s = document.createElement('span'); s.textContent = l; const b = document.createElement('b'); b.textContent = v; b.style.fontSize = String(v).length > 12 ? '15px' : ''; d.append(s, b); c.append(d); });
    const u = db.hist.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    $('#p-ult').replaceChildren(db.bobinas.length ? tbl(['Data', 'Bobina', 'Origem', 'Destino'], u, [h => fmt(h.data), h => h.codigo, h => h.origem, h => h.destino])
      : Object.assign(document.createElement('p'), { className: 'note', textContent: 'Nenhuma bobina ainda. Comece em “Cadastrar bobina”.' }));
  },
  consulta() {
    const l = db.bobinas.filter(b => match(b, $('#q1').value) && (!$('#fsit').value || b.situacao === $('#fsit').value));
    $('#t-cons').replaceChildren(tbl(['Código', 'Material', 'Peso (kg)', 'Local registrado', 'Situação'], l,
      [b => b.codigo, b => b.material, b => b.peso, b => loc(b), b => b.situacao],
      [['Ver', b => { show('localizar'); det(b); }], ['Editar', editar, 'gr'], ['Mover', b => irMover(b.id), 'ok'], ['Excluir', excluir, 'dg']]));
  },
  localizar() {
    const q = $('#q2').value, r = $('#res'); r.replaceChildren(); if (!q.trim()) return;
    const l = db.bobinas.filter(b => match(b, q)).slice(0, 20);
    if (!l.length) { r.append(Object.assign(document.createElement('p'), { textContent: 'Bobina não encontrada.', className: 'note' })); return; }
    r.append(tbl(['Código', 'Material', 'Local'], l, [b => b.codigo, b => b.material, b => loc(b)], [['Detalhes', det]]));
  },
  mover() { selBobinas('#fmov [name=bobina]'); const f = $('#fmov'); if (!f.data.value) f.data.value = nowLocal(); f.bobina.onchange(); },
  hist() {
    const g = id => $(id).value.trim().toLowerCase(), de = $('#hde').value, ate = $('#hate').value;
    const l = db.hist.filter(h => h.codigo.toLowerCase().includes(g('#hb')) && h.origem.toLowerCase().includes(g('#ho')) && h.destino.toLowerCase().includes(g('#hd'))
      && (!de || h.data.slice(0, 10) >= de) && (!ate || h.data.slice(0, 10) <= ate)).sort((a, b) => b.data.localeCompare(a.data));
    $('#t-hist').replaceChildren(histTbl(l));
  },
  alertas() {
    selBobinas('#fconf [name=bobina]');
    $('#t-stale').replaceChildren(tbl(['Código', 'Local registrado', 'Última referência'], stale(), [b => b.codigo, b => loc(b), b => fmt(ref(b))], [['Conferir', b => { $('#fconf [name=bobina]').value = b.id; $('#fconf').scrollIntoView(); }]]));
    $('#t-div').replaceChildren(tbl(['Data', 'Bobina', 'Registrado', 'Encontrado', 'Status'], db.div.slice().reverse(), [d => fmt(d.data), d => d.codigo, d => d.registrado, d => loc(d.enc), d => d.status],
      [['Usar local encontrado', d => resolver(d, true), 'ok'], ['Manter registrado', d => resolver(d, false), 'gr']].map(([l, f, c]) => [l, d => d.status === 'Pendente' && f(d), c])));
  },
  relat() { $('#rinfo').textContent = `Prévia: ${fB().length} bobina(s) e ${fH().length} movimentação(ões) nos filtros atuais.`; },
  config() {
    const f = $('#fcfg'); ['empresa', 'unidade', 'prazo'].forEach(k => (f[k].value = db.cfg[k]));
    $('#cont').textContent = `Armazenados: ${db.bobinas.length} bobinas, ${db.hist.length} movimentações, ${db.div.length} divergências.`;
  }
};
function histTbl(l) { return tbl(['Data', 'Bobina', 'Origem', 'Destino', 'Responsável', 'Motivo', 'Obs.'], l, [h => fmt(h.data), h => h.codigo, h => h.origem, h => h.destino, h => h.resp, h => h.motivo, h => h.obs]); }
function selBobinas(sel) {
  const s = $(sel), cur = s.value; s.replaceChildren(new Option('— selecione —', ''));
  db.bobinas.forEach(b => s.add(new Option(b.codigo + ' · ' + b.material, b.id))); s.value = cur;
}
function det(b) {
  const d = $('#det'); d.replaceChildren();
  const h = document.createElement('h3'); h.textContent = 'Bobina ' + b.codigo; d.append(h);
  [['Material', b.material], ['Peso', b.peso + ' kg'], ['Localização registrada', loc(b)], ['Última movimentação', fmt(b.ultimaMov)], ['Última posição confirmada (conferência)', b.conferidaEm ? fmt(b.conferidaEm) : null], ['Situação', b.situacao], ['Lote', b.lote], ['Fornecedor', b.fornecedor], ['Observações', b.obs]]
    .forEach(([k, v]) => { const p = document.createElement('p'), s = document.createElement('b'); s.textContent = k + ': '; p.append(s, v || '—'); d.append(p); });
  d.append(btn('Registrar movimentação', () => irMover(b.id)), document.createElement('h3'));
  d.lastChild.textContent = 'Histórico completo';
  d.append(histTbl(db.hist.filter(x => x.codigo === b.codigo).sort((a, c) => c.data.localeCompare(a.data))));
}

/* ===== Ações ===== */
function editar(b) {
  const f = $('#fcad'); show('cadastro');
  [...f.elements].forEach(e => { if (e.name) e.value = b[e.name] ?? ''; });
  f.dataset.id = b.id; f.querySelector('[type=submit]').textContent = 'Salvar alterações';
}
function excluir(b) {
  if (!confirm(`Excluir a bobina ${b.codigo}? O histórico de movimentações será mantido.`)) return;
  db.bobinas = db.bobinas.filter(x => x.id !== b.id); save(); toast('Bobina excluída.'); R.consulta();
}
function irMover(id) { show('mover'); $('#fmov [name=bobina]').value = id; $('#fmov [name=bobina]').onchange(); }
function resolver(d, usar) {
  const b = db.bobinas.find(x => x.codigo === d.codigo);
  if (usar && b) { if (!confirm('Atualizar a localização registrada para o local encontrado?')) return; const o = loc(b); Object.assign(b, d.enc); addHist(b, o, loc(b), 'Correção por conferência', '', ''); }
  d.status = usar ? 'Resolvida (local atualizado)' : 'Resolvida (mantido)'; save(); toast('Divergência tratada.'); R.alertas();
}
const LOC = [['galpao', 'Galpão', 'text', 1], ['setor', 'Setor'], ['corredor', 'Corredor'], ['posicao', 'Posição']];

/* ===== Exportação / importação ===== */
function download(nome, txt, tipo) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + txt], { type: tipo })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
const cel = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
const csv = (cols, rows) => [cols.map(c => cel(c[0])).join(';'), ...rows.map(r => cols.map(c => cel(r[c[1]])).join(';'))].join('\r\n');
function fB() {
  const g = id => $(id).value.trim().toLowerCase();
  return db.bobinas.filter(b => (b.material || '').toLowerCase().includes(g('#rmat')) && (b.galpao || '').toLowerCase().includes(g('#rgal')) && (b.situacao || '').toLowerCase().includes(g('#rsit')));
}
function fH() { const de = $('#rde').value, ate = $('#rate').value; return db.hist.filter(h => (!de || h.data.slice(0, 10) >= de) && (!ate || h.data.slice(0, 10) <= ate)); }
function backup() { download(`bobinatrack-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), 'application/json'); toast('Backup gerado.'); }
function restaurar(file) {
  const rd = new FileReader();
  rd.onerror = () => toast('Erro ao ler o arquivo.', 1);
  rd.onload = () => {
    try {
      const o = JSON.parse(String(rd.result).replace(/^\ufeff/, ''));
      if (!Array.isArray(o.bobinas) || !Array.isArray(o.hist)) throw new Error('estrutura');
      const cods = new Set();
      o.bobinas.forEach(b => { if (!b || typeof b.codigo !== 'string' || !b.codigo.trim() || !b.id) throw new Error('bobina inválida'); const k = b.codigo.toLowerCase(); if (cods.has(k)) throw new Error('código duplicado: ' + b.codigo); cods.add(k); });
      if (!confirm(`Isto SUBSTITUI todos os dados atuais por ${o.bobinas.length} bobinas e ${o.hist.length} movimentações. Continuar?`)) return;
      db = { bobinas: o.bobinas, hist: o.hist, div: Array.isArray(o.div) ? o.div : [], cfg: { ...db.cfg, ...(o.cfg || {}) } };
      save(); toast('Backup restaurado.'); show('config');
    } catch (e) { toast('Arquivo inválido: ' + e.message, 1); }
  };
  rd.readAsText(file);
}

/* ===== Inicialização e eventos ===== */
function init() {
  load();
  V.forEach(([v, t]) => { const b = document.createElement('button'); b.textContent = t; b.dataset.v = v; b.onclick = () => show(v); $('#menu').append(b); });
  $('#burger').onclick = () => $('#side').classList.toggle('open');
  $('#emp').textContent = [db.cfg.empresa, db.cfg.unidade].filter(Boolean).join(' · ');
  $('#fsit').add(new Option('Todas as situações', '')); SIT.forEach(s => $('#fsit').add(new Option(s)));

  mk($('#fcad'), [['codigo', 'Número de identificação', 'text', 1], ['interno', 'Código interno'], ['lote', 'Lote ou ordem'], ['material', 'Tipo de material', 'text', 1], ['descricao', 'Descrição'],
    ['peso', 'Peso (kg)', 'number', 1], ['largura', 'Largura (mm)', 'number'], ['espessura', 'Espessura (mm)', 'number'], ['diametro', 'Diâmetro (mm)', 'number'], ['fornecedor', 'Fornecedor'],
    ['recebimento', 'Data de recebimento', 'date'], ...LOC, ['situacao', 'Situação', 'sel', 0, SIT], ['obs', 'Observações', 'area']]);
  mk($('#fmov'), [['bobina', 'Bobina', 'sel', 1, []], ['origem', 'Origem (última localização)'], ...LOC.map(([n, l, t, r]) => [n, 'Destino: ' + l.toLowerCase(), t, r]),
    ['sit', 'Nova situação', 'sel', 0, ['Manter', ...SIT]], ['data', 'Data e hora', 'datetime-local', 1], ['resp', 'Responsável', 'text', 1], ['motivo', 'Motivo', 'text', 1], ['obs', 'Observações', 'area']]);
  mk($('#fconf'), [['bobina', 'Bobina', 'sel', 1, []], ...LOC.map(([n, l, t, r]) => [n, 'Encontrada em: ' + l.toLowerCase(), t, r])]);
  mk($('#fcfg'), [['empresa', 'Nome da empresa'], ['unidade', 'Nome da unidade'], ['prazo', 'Prazo p/ localização desatualizada (dias)', 'number', 1]]);
  $('#fmov [name=origem]').readOnly = true;
  $('#fmov [name=bobina]').onchange = () => { const b = find($('#fmov [name=bobina]').value); $('#fmov [name=origem]').value = b ? loc(b) || '(sem local)' : ''; };

  $('#fcad').onsubmit = e => {
    e.preventDefault(); const f = e.target, d = getData(f), id = f.dataset.id; d.codigo = d.codigo.trim();
    if (!d.codigo || !d.material.trim() || !d.galpao.trim() || !(+d.peso > 0)) return toast('Preencha código, material, peso (> 0) e galpão.', 1);
    if (db.bobinas.some(b => b.codigo.toLowerCase() === d.codigo.toLowerCase() && b.id !== id)) return toast('Já existe uma bobina com este código.', 1);
    if (id) { const b = find(id), o = loc(b); Object.assign(b, d); if (loc(b) !== o) addHist(b, o, loc(b), 'Edição de cadastro', '', ''); toast('Bobina atualizada.'); }
    else { db.bobinas.push({ id: uid(), ...d, criadoEm: new Date().toISOString(), ultimaMov: null }); toast('Bobina cadastrada.'); }
    save(); f.reset(); delete f.dataset.id; f.querySelector('[type=submit]').textContent = 'Salvar'; show('consulta');
  };
  $('#fmov').onsubmit = e => {
    e.preventDefault(); const f = e.target, d = getData(f), b = find(d.bobina);
    if (!b) return toast('Selecione a bobina.', 1);
    if (!d.galpao.trim() || !d.resp.trim() || !d.motivo.trim() || !d.data) return toast('Informe destino (galpão), data, responsável e motivo.', 1);
    const o = loc(b) || '(sem local)'; ['galpao', 'setor', 'corredor', 'posicao'].forEach(k => (b[k] = d[k].trim()));
    if (d.sit !== 'Manter') b.situacao = d.sit;
    addHist(b, o, loc(b), d.motivo.trim(), d.resp.trim(), d.obs, new Date(d.data).toISOString());
    save(); f.reset(); f.data.value = nowLocal(); toast('Movimentação registrada com sucesso.'); show('hist');
  };
  $('#fconf').onsubmit = e => {
    e.preventDefault(); const f = e.target, d = getData(f), b = find(d.bobina);
    if (!b || !d.galpao.trim()) return toast('Selecione a bobina e informe ao menos o galpão encontrado.', 1);
    const enc = { galpao: d.galpao.trim(), setor: d.setor.trim(), corredor: d.corredor.trim(), posicao: d.posicao.trim() };
    b.conferidaEm = new Date().toISOString();
    if (loc(enc) === loc(b)) toast('Conferido: local confere com o registro.');
    else { db.div.push({ id: uid(), codigo: b.codigo, registrado: loc(b), enc, data: b.conferidaEm, status: 'Pendente' }); toast('Divergência registrada.', 1); }
    save(); f.reset(); R.alertas();
  };
  $('#fcfg').onsubmit = e => {
    e.preventDefault(); const d = getData(e.target);
    if (!(+d.prazo >= 1)) return toast('O prazo deve ser de pelo menos 1 dia.', 1);
    db.cfg = { empresa: d.empresa.trim(), unidade: d.unidade.trim(), prazo: +d.prazo }; save();
    $('#emp').textContent = [db.cfg.empresa, db.cfg.unidade].filter(Boolean).join(' · '); toast('Configurações salvas.');
  };
  ['#q1', '#fsit'].forEach(s => ($(s).oninput = R.consulta)); $('#q2').oninput = R.localizar;
  ['#hb', '#hde', '#hate', '#ho', '#hd'].forEach(s => ($(s).oninput = R.hist));
  ['#rde', '#rate', '#rmat', '#rgal', '#rsit'].forEach(s => ($(s).oninput = R.relat));
  $('#b-csvb').onclick = () => download('bobinas.csv', csv([['Código', 'codigo'], ['Código interno', 'interno'], ['Lote', 'lote'], ['Material', 'material'], ['Peso kg', 'peso'], ['Fornecedor', 'fornecedor'], ['Galpão', 'galpao'], ['Setor', 'setor'], ['Corredor', 'corredor'], ['Posição', 'posicao'], ['Situação', 'situacao']], fB()), 'text/csv');
  $('#b-csvh').onclick = () => download('historico.csv', csv([['Data', 'data'], ['Bobina', 'codigo'], ['Origem', 'origem'], ['Destino', 'destino'], ['Responsável', 'resp'], ['Motivo', 'motivo'], ['Obs', 'obs']], fH()), 'text/csv');
  $('#b-json').onclick = $('#b-bkp').onclick = backup;
  $('#b-rest').onchange = e => { if (e.target.files[0]) restaurar(e.target.files[0]); e.target.value = ''; };
  show('painel');
}
init();
