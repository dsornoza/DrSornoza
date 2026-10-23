/*
 * Guía para construir competencias — flujo en tres pasos (cliente puro):
 *   1) Datos de partida  2) Borrador completo generado por la IA  3) El docente revisa, edita, pide revisión y exporta.
 * Depende de: ../assets/core.js (ST), ../assets/access.js (ST.access), prompts.js (COMP_PROMPTS), ficha.js (Ficha).
 * Toda la IA pasa por ST.access.generate(); los textos que guían a la IA están en prompts.js.
 */
(function () {
  'use strict';
  const ST = window.ST, P = window.COMP_PROMPTS, esc = ST.esc;
  const T = (es, en) => (ST.lang === 'en' ? en : es);
  const SKEY = 'st_comp_ficha';

  /* ---------- Campos ---------- */
  const f = (id, es, en, o) => Object.assign({ id, label: { es, en } }, o || {});
  const LIST = { type: 'textarea', rows: 5, hint: { es: 'Una idea por línea.', en: 'One idea per line.' } };

  const START = [
    f('carrera', 'Carrera', 'Degree program', { required: true, type: 'text', placeholder: { es: 'Ej.: Ingeniería Civil', en: 'E.g.: Civil Engineering' } }),
    f('asignatura', 'Asignatura o campo de formación', 'Course or field', { required: true, type: 'text', placeholder: { es: 'Ej.: Tecnologías del Hormigón', en: 'E.g.: Concrete Technology' } }),
    f('nivel', 'Nivel', 'Level', { type: 'text', placeholder: { es: 'Ej.: Pregrado intermedio-avanzado', en: 'E.g.: Mid-to-late undergraduate' } }),
    f('modelo', 'Competencia del Modelo (Tabla 1)', 'Model competency (Table 1)', { type: 'text', placeholder: { es: 'Como aparece en el Modelo', en: 'As it appears in the Model' } }),
    f('perfil', 'Perfil de egreso o resultados de aprendizaje relacionados', 'Graduate profile or related learning outcomes', { required: true, type: 'textarea', rows: 6, span: 'full', placeholder: { es: 'Pega aquí el perfil de egreso o los resultados de aprendizaje con los que se relaciona esta competencia.', en: 'Paste the graduate profile or learning outcomes this competency relates to.' } }),
    f('indicaciones', 'Indicaciones adicionales (opcional)', 'Additional notes (optional)', { type: 'textarea', rows: 3, span: 'full', placeholder: { es: 'Ej.: metodología preferida, contexto local, tipo de evidencia que ya usas…', en: 'E.g.: preferred methodology, local context, type of evidence you already use…' } }),
  ];

  const SECTIONS = [
    { id: 'competencia', title: { es: '1. Competencia', en: '1. Competency' }, sub: { es: 'Verbo de actuación + objeto + condición + finalidad', en: 'Action verb + object + condition + purpose' }, fields: [f('competencia', 'Competencia', 'Competency', { type: 'textarea', rows: 4 })] },
    { id: 'conocimientos', title: { es: '2a. Conocimientos', en: '2a. Knowledge' }, sub: { es: 'Lo que se debe saber y comprender', en: 'What must be known and understood' }, fields: [f('conocimientos', 'Conocimientos', 'Knowledge', LIST)] },
    { id: 'capacidades', title: { es: '2b. Capacidades', en: '2b. Capacities' }, sub: { es: 'Potencial para actuar ante lo nuevo', en: 'Potential to act in new situations' }, fields: [f('capacidades', 'Capacidades', 'Capacities', LIST)] },
    { id: 'habilidades', title: { es: '2c. Habilidades', en: '2c. Skills' }, sub: { es: 'Acciones y procedimientos por dominar', en: 'Actions and procedures to master' }, fields: [f('habilidades', 'Habilidades', 'Skills', LIST)] },
    { id: 'valores', title: { es: '2d. Valores', en: '2d. Values' }, sub: { es: 'Sentido ético y social de la actuación', en: 'Ethical and social meaning of the action' }, fields: [f('valores', 'Valores', 'Values', LIST)] },
    { id: 'situacion', title: { es: '3. Situación profesional', en: '3. Professional situation' }, sub: { es: 'Problema real del contexto donde se pone en acto', en: 'Real problem of the context where it is enacted' }, fields: [f('situacion', 'Situación profesional', 'Professional situation', { type: 'textarea', rows: 5 })] },
    { id: 'estrategia', title: { es: '4. Estrategia formativa', en: '4. Learning strategy' }, sub: { es: 'Metodología del Modelo y actividades de anticipación, construcción y consolidación', en: 'Model methodology and anticipation, construction and consolidation activities' }, fields: [
      f('anticipacion', 'Anticipación', 'Anticipation', { type: 'textarea', rows: 3 }),
      f('metodologia', 'Metodología de la construcción', 'Construction methodology', { type: 'text' }),
      f('construccion', 'Construcción', 'Construction', { type: 'textarea', rows: 3 }),
      f('consolidacion', 'Consolidación', 'Consolidation', { type: 'textarea', rows: 3 }),
      f('metacognicion', 'Metacognición', 'Metacognition', { type: 'textarea', rows: 2 })] },
    { id: 'evidencia', title: { es: '5. Evidencia y criterios', en: '5. Evidence and criteria' }, sub: { es: 'Desempeño o producto observable y tres criterios de valoración', en: 'Observable performance or product and three assessment criteria' }, fields: [
      f('evidencia', 'Evidencia', 'Evidence', { type: 'textarea', rows: 3 }),
      f('crit1', 'Criterio 1', 'Criterion 1', { type: 'textarea', rows: 2 }),
      f('crit2', 'Criterio 2', 'Criterion 2', { type: 'textarea', rows: 2 }),
      f('crit3', 'Criterio 3', 'Criterion 3', { type: 'textarea', rows: 2 })] },
    { id: 'articulacion', title: { es: '6. Articulación', en: '6. Articulation' }, sub: { es: 'Asignatura, nivel y vínculo con investigación o vinculación con la sociedad', en: 'Course, level, and link to research or community engagement' }, fields: [
      f('art_asignatura', 'Asignatura', 'Course', { type: 'text' }),
      f('art_nivel', 'Nivel y carrera', 'Level and program', { type: 'text' }),
      f('art_vinculo', 'Vínculo con investigación o vinculación con la sociedad', 'Link to research or community engagement', { type: 'textarea', rows: 3 })] },
  ];
  const FICHA_IDS = [].concat(...SECTIONS.map((s) => s.fields.map((x) => x.id)));
  const AI_IDS = FICHA_IDS.filter((id) => !['art_asignatura', 'art_nivel'].includes(id));

  /* ---------- Estado (guardado solo en este navegador) ---------- */
  let S = { screen: 'inicio', mode: 'edit', data: {} };
  try {
    const raw = JSON.parse(ST.LS.get(SKEY, 'null'));
    if (raw && raw.data) S = { screen: raw.screen === 'ficha' ? 'ficha' : 'inicio', mode: 'edit', data: raw.data };
  } catch (e) { /* estado nuevo */ }
  let coherence = '', busy = false, abort = null, saveTimer = 0;
  const save = () => ST.LS.set(SKEY, JSON.stringify({ screen: S.screen, data: S.data }));
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); };
  const val = (id) => String(S.data[id] || '').trim();
  const startOk = () => START.filter((x) => x.required).every((x) => val(x.id));
  const hasFicha = () => FICHA_IDS.some((id) => val(id));

  /* ---------- IA ---------- */
  const fill = (tpl, o) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (o[k] !== undefined ? o[k] : ''));
  const sys = () => fill(P.base, { idioma: ST.lang === 'en' ? 'inglés' : 'español' });
  const startText = () => START.filter((x) => val(x.id)).map((x) => `${x.label.es}: ${val(x.id)}`).join('\n') || '(sin datos)';
  const criteriosText = () => Object.keys(P.pasos).map((k) => `### ${P.pasos[k].nombre}\n${P.pasos[k].criterios}`).join('\n\n');
  const ejemploText = () => ['competencia', 'conocimientos', 'capacidades', 'habilidades', 'valores', 'situacion', 'estrategia', 'evidencia', 'articulacion'].map((k) => `## ${P.pasos[k].nombre}\n${P.ejemplos[k]}`).join('\n\n');

  function parseJson(text) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('JSON');
    const o = JSON.parse(text.slice(a, b + 1));
    if (!o || typeof o !== 'object') throw new Error('JSON');
    return o;
  }
  const asText = (v) => (Array.isArray(v) ? v.join('\n') : String(v == null ? '' : v)).trim();

  const showError = (msg) => { const e = document.getElementById('cp-error'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } };
  const clearError = () => { const e = document.getElementById('cp-error'); if (e) e.classList.add('hidden'); };
  function setBusy(b) {
    document.querySelectorAll('.cp-ai').forEach((x) => { x.disabled = b; });
    const stop = document.getElementById('cp-stop'); if (stop) stop.classList.toggle('hidden', !b);
    const sp = document.getElementById('cp-spin'); if (sp) sp.classList.toggle('hidden', !b);
  }

  async function call(userText, onChunk) {
    busy = true; abort = new AbortController(); setBusy(true);
    try { return await ST.access.generate({ system: sys(), messages: [{ role: 'user', text: userText }], temperature: 0.6, signal: abort.signal, onChunk }); }
    finally { busy = false; abort = null; setBusy(false); }
  }

  function generateDraft() {
    clearError();
    if (!startOk()) { showError(T('Completa los campos obligatorios (*) para generar el borrador.', 'Fill in the required fields (*) to generate the draft.')); return; }
    if (hasFicha() && S.screen === 'ficha' && !confirm(T('Se reemplazará el contenido actual de la ficha por un nuevo borrador. ¿Continuar?', 'The current sheet content will be replaced by a new draft. Continue?'))) return;
    ST.access.ensureReady(async () => {
      const prompt = fill(P.borrador, { datos: startText(), criterios: criteriosText(), ejemplo: ejemploText() });
      try {
        const r = await call(prompt);
        const o = parseJson(r.text);
        AI_IDS.forEach((id) => { S.data[id] = asText(o[id]); });
        S.data.art_asignatura = val('asignatura');
        S.data.art_nivel = [val('nivel'), val('carrera') ? T('carrera de ', 'program: ') + val('carrera') : ''].filter(Boolean).join(', ');
        coherence = ''; S.screen = 'ficha'; S.mode = 'edit'; save(); render(); window.scrollTo({ top: 0 });
      } catch (e) {
        if (e.name === 'AbortError') return;
        showError(e.message === 'JSON' || e instanceof SyntaxError ? T('La IA no devolvió el borrador en el formato esperado. Inténtalo de nuevo.', 'The AI did not return the draft in the expected format. Please try again.') : e.message);
      }
    });
  }

  function checkCoherence() {
    clearError();
    ST.access.ensureReady(async () => {
      const box = document.getElementById('cp-coh');
      box.classList.remove('hidden'); box.innerHTML = '<div class="md-out st-cursor">…</div>';
      const ficha = window.Ficha.toText(window.Ficha.build(S.data, 'es'));
      const prompt = fill(P.coherencia, { contexto: `DATOS DE PARTIDA:\n${startText()}\n\n${ficha}` });
      let shown = '';
      try {
        const r = await call(prompt, (_, full) => { shown = full; const m = box.querySelector('.md-out'); if (m) m.innerHTML = ST.mdToHtml(full); });
        coherence = r.text;
        if (r.finish && r.finish !== 'STOP') coherence += `\n\n> ${ST.t(['MAX_TOKENS', 'CUT'].includes(r.finish) ? 'truncated' : 'stopped').replace('{r}', r.finish)}`;
      } catch (e) {
        coherence = e.name === 'AbortError' && shown ? shown + '\n\n> ' + T('Detenido.', 'Stopped.') : '';
        if (e.name !== 'AbortError') showError(e.message);
      }
      paintCoherence();
    });
  }
  function paintCoherence() {
    const box = document.getElementById('cp-coh'); if (!box) return;
    if (coherence) { box.classList.remove('hidden'); box.innerHTML = `<div class="md-out">${ST.mdToHtml(coherence)}</div>`; } else box.classList.add('hidden');
  }

  /* ---------- Render ---------- */
  const shell = ST.shell({});
  function fieldHtml(x) {
    const v = S.data[x.id] || '', full = x.span === 'full' || x.type === 'textarea';
    const ph = esc(ST.t(x.placeholder) || '');
    const inp = x.type === 'textarea'
      ? `<textarea class="st-input" data-f="${x.id}" rows="${x.rows || 4}" placeholder="${ph}">${esc(v)}</textarea>`
      : `<input class="st-input" type="text" data-f="${x.id}" value="${esc(v)}" placeholder="${ph}">`;
    return `<div class="${full ? 'md:col-span-2' : ''}"><label class="st-label">${esc(ST.t(x.label) + (x.required ? ' *' : ''))}</label>${inp}${x.hint ? `<p class="st-hint">${esc(ST.t(x.hint))}</p>` : ''}</div>`;
  }
  const spinner = '<span class="st-spin hidden" id="cp-spin" style="border-color:rgba(6,182,212,.3);border-top-color:var(--primary)"></span>';
  const stopBtn = `<button type="button" class="st-btn hidden" id="cp-stop">${esc(ST.t('stop'))}</button>`;

  function startScreen() {
    return `<section class="st-card p-5 md:p-6">
        <h2 class="text-xl font-bold">${esc(T('1. Tus datos de partida', '1. Your starting data'))}</h2>
        <p class="mt-1" style="color:var(--muted-foreground)">${esc(T('Con estos datos la IA propone un borrador completo de la ficha. Después tú lo revisas y lo ajustas.', 'With this data the AI proposes a complete draft of the sheet. Then you review and adjust it.'))}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">${START.map(fieldHtml).join('')}</div>
        <div id="cp-error" class="st-error mt-4 hidden"></div>
        <div class="flex flex-wrap items-center gap-3 mt-5">
          <button type="button" class="st-btn st-btn-primary cp-ai" id="cp-gen">✨ ${esc(T('Generar borrador de la ficha', 'Generate sheet draft'))}</button>
          ${hasFicha() ? `<button type="button" class="st-btn" id="cp-back">${esc(T('Volver a mi ficha', 'Back to my sheet'))}</button>` : ''}
          ${spinner}${stopBtn}
        </div>
      </section>`;
  }

  function fichaScreen() {
    const preview = S.mode === 'preview';
    const fi = window.Ficha.build(S.data, ST.lang);
    const bar = `<div class="flex flex-wrap items-center gap-2 mb-4 no-print">
        <button type="button" class="st-btn st-btn-sm" id="cp-mode">${esc(preview ? T('✏️ Editar', '✏️ Edit') : T('👁 Vista previa', '👁 Preview'))}</button>
        <button type="button" class="st-btn st-btn-sm" id="cp-copy">📋 ${esc(ST.t('copy'))}</button>
        <button type="button" class="st-btn st-btn-sm" id="cp-docx">⬇ Word (.docx)</button>
        <button type="button" class="st-btn st-btn-sm" id="cp-pdf">🖨 PDF</button>
        <span class="mr-auto"></span>
        <button type="button" class="st-btn st-btn-sm" id="cp-startedit">← ${esc(T('Datos de partida', 'Starting data'))}</button>
      </div>`;
    const body = preview
      ? `<div id="ficha-doc"><h2 class="font-bold text-lg mb-2">${esc(fi.title)}</h2><div style="overflow-x:auto">${window.Ficha.toHtml(fi)}</div></div>`
      : SECTIONS.map((s) => `<section class="st-card p-5 mb-4"><h3 class="font-bold text-lg">${esc(ST.t(s.title))}</h3><p class="text-sm italic mb-3" style="color:var(--muted-foreground)">${esc(ST.t(s.sub))}</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4">${s.fields.map((x) => fieldHtml(Object.assign({}, x, { span: 'full' }))).join('')}</div></section>`).join('');
    return `<div class="st-beta mb-4 no-print">${esc(T('Este es un borrador generado a partir de tus datos. Revísalo, corrígelo y hazlo tuyo: la IA puede equivocarse y la autoría y la decisión final son tuyas.', 'This is a draft generated from your data. Review it, correct it and make it yours: the AI can be wrong, and authorship and the final decision are yours.'))}</div>
      ${bar}
      <div id="cp-error" class="st-error mb-4 hidden"></div>
      ${body}
      <section class="st-card p-5 mt-4 no-print">
        <h3 class="font-bold text-lg">${esc(T('Revisión de coherencia', 'Coherence review'))}</h3>
        <p class="text-sm" style="color:var(--muted-foreground)">${esc(T('Cuando hayas ajustado la ficha, pide a la IA que revise si los componentes se sostienen entre sí. Te dirá qué mejorar; tú decides qué cambiar.', 'Once you have adjusted the sheet, ask the AI to check whether the components support each other. It will tell you what to improve; you decide what to change.'))}</p>
        <div class="flex flex-wrap items-center gap-2 mt-3">
          <button type="button" class="st-btn st-btn-primary cp-ai" id="cp-check">🧭 ${esc(T('Revisar coherencia', 'Review coherence'))}</button>
          <button type="button" class="st-btn cp-ai" id="cp-regen">🔄 ${esc(T('Generar un borrador nuevo', 'Generate a new draft'))}</button>
          ${spinner}${stopBtn}
        </div>
        <div id="cp-coh" class="mt-3 rounded-lg border p-4 hidden" style="border-color:rgba(6,182,212,.35);background:rgba(6,182,212,.05)"></div>
      </section>`;
  }

  function render() {
    const main = shell();
    document.title = T('Guía para construir competencias', 'Competency-building guide') + ' — Sornoza.com';
    main.innerHTML = `
      <main class="container mx-auto max-w-4xl px-4 md:px-8 py-8">
        <div class="mb-5 no-print">
          <a href="${ST.BASE}" class="text-sm sm:hidden" style="color:var(--muted-foreground)">← ${esc(ST.t('catalog'))}</a>
          <h1 class="text-2xl md:text-3xl font-bold mt-1 flex items-center gap-2"><i data-lucide="compass" class="h-7 w-7" style="color:var(--primary)"></i>${esc(T('Guía para construir competencias', 'Competency-building guide'))}</h1>
          <p class="mt-2" style="color:var(--muted-foreground)">${esc(T('Dame tus datos de partida y obtén un borrador completo de tu ficha de competencia (Anexo B). Luego lo revisas, lo ajustas y lo exportas a Word o PDF.', 'Give me your starting data and get a complete draft of your competency sheet (Annex B). Then review it, adjust it and export it to Word or PDF.'))}</p>
        </div>
        <div class="st-notice mb-4 no-print" data-key-notice>${esc(ST.t('need_key'))} <button class="underline font-semibold" id="st-open-key">${esc(ST.t('key_set'))}</button></div>
        ${S.screen === 'ficha' ? fichaScreen() : startScreen()}
        <p class="st-hint mt-3 no-print">${esc(T('Tu progreso se guarda automáticamente en este navegador. Lo que escribes se envía a Google (Gemini) con tu API Key solo cuando generas el borrador o pides la revisión.', 'Your progress is saved automatically in this browser. What you write is sent to Google (Gemini) with your API key only when you generate the draft or ask for the review.'))}</p>
      </main>`;
    bind();
    paintCoherence();
    ST.updateKeyUi && ST.updateKeyUi();
    ST.refreshIcons();
    setBusy(busy);
  }

  function bind() {
    const root = document.getElementById('st-main');
    const key = document.getElementById('st-open-key'); if (key) key.onclick = () => ST.openKeyModal();
    root.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', () => { S.data[el.dataset.f] = el.value; saveSoon(); }));
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on('cp-gen', generateDraft);
    on('cp-regen', generateDraft);
    on('cp-check', checkCoherence);
    on('cp-stop', () => abort && abort.abort());
    on('cp-back', () => { S.screen = 'ficha'; save(); render(); });
    on('cp-startedit', () => { save(); S.screen = 'inicio'; save(); render(); });
    on('cp-mode', () => { S.mode = S.mode === 'preview' ? 'edit' : 'preview'; render(); });
    on('cp-copy', async (e) => { const b = e.currentTarget, old = b.innerHTML; const ok = await window.Ficha.copy(window.Ficha.build(S.data, ST.lang)); b.textContent = ok ? ST.t('copied') : T('No se pudo copiar', 'Could not copy'); setTimeout(() => (b.innerHTML = old), 1600); });
    on('cp-docx', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      const name = val('asignatura').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'borrador';
      try { await window.Ficha.toDocx(window.Ficha.build(S.data, ST.lang), 'ficha-competencia-' + name + '.docx'); }
      catch (err) { showError(T('No se pudo generar el Word: ', 'Could not generate the Word file: ') + err.message); }
      b.disabled = false;
    });
    on('cp-pdf', () => {
      if (S.mode !== 'preview') { S.mode = 'preview'; render(); }
      setTimeout(() => window.print(), 150);
    });
  }

  ST.onLang(render);
  document.documentElement.lang = ST.lang;
  render();
})();
