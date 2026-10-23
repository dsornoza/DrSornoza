/*
 * Guía para construir competencias — asistente paso a paso (cliente puro).
 * Depende de: ../assets/core.js (ST), ../assets/access.js (ST.access), prompts.js (COMP_PROMPTS), ficha.js (Ficha).
 * Toda la IA pasa por ST.access.generate(); los textos que guían a la IA están en prompts.js.
 */
(function () {
  'use strict';
  const ST = window.ST, P = window.COMP_PROMPTS, esc = ST.esc;
  const T = (es, en) => (ST.lang === 'en' ? en : es);
  const SKEY = 'st_comp_ficha';

  /* ---------- Definición de pasos y campos ---------- */
  const f = (id, es, en, o) => Object.assign({ id, label: { es, en } }, o || {});
  const hint = (es, en) => ({ hint: { es, en } });
  const LIST = (o) => Object.assign({ type: 'textarea', rows: 6 }, hint('Una idea por línea (sin viñetas). Entre 3 y 6.', 'One idea per line (no bullets). Between 3 and 6.'), o || {});

  const STEPS = [
    { id: 'inicio', short: { es: 'Inicio', en: 'Start' }, title: { es: 'Datos de partida', en: 'Starting data' },
      intro: { es: 'Cuéntame desde dónde partes. Estos datos le dan contexto a la IA en todos los pasos; no se publican ni se guardan fuera de tu navegador.', en: 'Tell me where you are starting from. This gives the AI context in every step; nothing is stored outside your browser.' },
      fields: [
        f('carrera', 'Carrera', 'Degree program', { required: true, type: 'text', placeholder: { es: 'Ej.: Ingeniería Civil', en: 'E.g.: Civil Engineering' } }),
        f('asignatura', 'Asignatura o campo de formación', 'Course or field', { required: true, type: 'text', placeholder: { es: 'Ej.: Tecnologías del Hormigón', en: 'E.g.: Concrete Technology' } }),
        f('nivel', 'Nivel', 'Level', { type: 'text', placeholder: { es: 'Ej.: Pregrado intermedio-avanzado', en: 'E.g.: Mid-to-late undergraduate' } }),
        f('modelo', 'Competencia del Modelo (Tabla 1)', 'Model competency (Table 1)', { type: 'text', placeholder: { es: 'Ej.: Conciencia ecológica y de la biodiversidad para la gestión de la sustentabilidad', en: 'Name of the institutional model competency it contributes to' }, ...hint('Escríbela tal como aparece en el Modelo.', 'Write it as it appears in the Model.') }),
        f('perfil', 'Perfil de egreso o resultados de aprendizaje relacionados', 'Graduate profile or related learning outcomes', { required: true, type: 'textarea', rows: 6, span: 'full', placeholder: { es: 'Pega aquí el perfil de egreso o los resultados de aprendizaje de la carrera/asignatura con los que se relaciona esta competencia.', en: 'Paste the graduate profile or learning outcomes this competency relates to.' } }),
      ] },

    { id: 'competencia', num: '1', short: { es: '1', en: '1' }, title: { es: '1. Competencia', en: '1. Competency' },
      intro: { es: 'Una sola oración con la fórmula: verbo de actuación + objeto + condición + finalidad.', en: 'A single sentence with the formula: action verb + object + condition + purpose.' },
      tip: { es: 'Primero piensa cada parte por separado; luego tú armas la oración. El verbo va en tercera persona del presente (Diseña, Evalúa…) y debe ser observable.', en: 'First think through each part separately; then you assemble the sentence. The verb goes in third person present (Designs, Evaluates…) and must be observable.' },
      fields: [
        f('verbo', 'Verbo de actuación', 'Action verb', { type: 'text', placeholder: { es: 'Ej.: Diseña y dosifica', en: 'E.g.: Designs and proportions' } }),
        f('objeto', 'Objeto (¿sobre qué actúa?)', 'Object (acts on what?)', { type: 'text' }),
        f('condicion', 'Condición (¿cómo o con qué criterios?)', 'Condition (how, under what criteria?)', { type: 'text' }),
        f('finalidad', 'Finalidad (¿para qué?)', 'Purpose (for what?)', { type: 'text' }),
        f('competencia', 'Competencia redactada', 'Written competency', { required: true, type: 'textarea', rows: 5, span: 'full', ...hint('Escribe la oración completa. Puedes usar el botón para armar un primer borrador con tus partes y luego mejorarlo.', 'Write the full sentence. You can use the button to assemble a first draft from your parts and then improve it.') }),
      ], compose: true },

    { id: 'conocimientos', num: '2a', short: { es: '2a', en: '2a' }, title: { es: '2a. Conocimientos', en: '2a. Knowledge' }, sub: { es: 'Lo que se debe saber y comprender', en: 'What must be known and understood' },
      intro: { es: 'Conceptos, principios, normas y datos que el estudiante necesita comprender para lograr la competencia.', en: 'Concepts, principles, standards and data that students must understand to achieve the competency.' },
      tip: { es: 'Son contenidos, no acciones. Pregúntate: ¿qué debe entender para poder actuar como describe la competencia?', en: 'These are content, not actions. Ask yourself: what must they understand to act as the competency describes?' },
      fields: [f('conocimientos', 'Conocimientos', 'Knowledge', LIST({ required: true }))] },
    { id: 'capacidades', num: '2b', short: { es: '2b', en: '2b' }, title: { es: '2b. Capacidades', en: '2b. Capacities' }, sub: { es: 'Potencial para actuar ante lo nuevo', en: 'Potential to act in new situations' },
      intro: { es: 'Lo que le permite actuar ante situaciones nuevas o inciertas: analizar críticamente, transferir, integrar, innovar, decidir.', en: 'What lets them act in new or uncertain situations: analyze critically, transfer, integrate, innovate, decide.' },
      tip: { es: 'No son procedimientos fijos (eso son habilidades), sino el potencial de usar lo aprendido en contextos distintos.', en: 'These are not fixed procedures (those are skills) but the potential to use learning in different contexts.' },
      fields: [f('capacidades', 'Capacidades', 'Capacities', LIST({ required: true }))] },
    { id: 'habilidades', num: '2c', short: { es: '2c', en: '2c' }, title: { es: '2c. Habilidades', en: '2c. Skills' }, sub: { es: 'Acciones y procedimientos por dominar', en: 'Actions and procedures to master' },
      intro: { es: 'Acciones y procedimientos concretos y observables que el estudiante debe dominar.', en: 'Concrete, observable actions and procedures students must master.' },
      tip: { es: 'Cada línea empieza con un verbo de acción y nombra la técnica, el instrumento o el producto.', en: 'Each line starts with an action verb and names the technique, tool or product.' },
      fields: [f('habilidades', 'Habilidades', 'Skills', LIST({ required: true }))] },
    { id: 'valores', num: '2d', short: { es: '2d', en: '2d' }, title: { es: '2d. Valores', en: '2d. Values' }, sub: { es: 'Sentido ético y social de la actuación', en: 'Ethical and social meaning of the action' },
      intro: { es: 'El sentido ético y social con el que se debe actuar en este contexto profesional.', en: 'The ethical and social sense with which one should act in this professional context.' },
      tip: { es: 'Evita palabras sueltas (“respeto”, “honestidad”). Vincula cada valor con la actuación profesional concreta.', en: 'Avoid isolated words (“respect”, “honesty”). Tie each value to concrete professional practice.' },
      fields: [f('valores', 'Valores', 'Values', LIST({ required: true }))] },

    { id: 'situacion', num: '3', short: { es: '3', en: '3' }, title: { es: '3. Situación profesional', en: '3. Professional situation' }, sub: { es: 'Problema real del contexto donde se pone en acto', en: 'Real problem of the context where it is enacted' },
      intro: { es: 'Un problema real del contexto donde el profesional pone en acto la competencia.', en: 'A real problem from the context where the professional enacts the competency.' },
      tip: { es: 'Incluye quién, dónde, qué restricciones y qué decisión debe tomar y justificar. Debe exigir conocimientos, capacidades, habilidades y valores a la vez.', en: 'Include who, where, what constraints, and what decision must be made and justified. It should require knowledge, capacities, skills and values at once.' },
      fields: [f('situacion', 'Situación profesional', 'Professional situation', { required: true, type: 'textarea', rows: 7, span: 'full' })] },

    { id: 'estrategia', num: '4', short: { es: '4', en: '4' }, title: { es: '4. Estrategia formativa', en: '4. Learning strategy' }, sub: { es: 'Metodología del Modelo y actividades de anticipación, construcción y consolidación', en: 'Model methodology and anticipation, construction and consolidation activities' },
      intro: { es: 'Cómo aprenderán los estudiantes: actividades de anticipación, construcción y consolidación, y una metacognición.', en: 'How students will learn: anticipation, construction and consolidation activities, plus metacognition.' },
      tip: { es: 'Describe lo que hace el estudiante en cada fase. La construcción debe usar una metodología activa (proyectos, casos, problemas…) alineada con la situación y la evidencia.', en: 'Describe what the student does in each phase. Construction should use an active methodology (projects, cases, problems…) aligned with the situation and the evidence.' },
      fields: [
        f('anticipacion', 'Anticipación', 'Anticipation', { type: 'textarea', rows: 3, span: 'full', required: true }),
        f('metodologia', 'Metodología de la construcción', 'Construction methodology', { type: 'text', span: 'full', placeholder: { es: 'Ej.: Aprendizaje Basado en Proyectos', en: 'E.g.: Project-Based Learning' } }),
        f('construccion', 'Construcción', 'Construction', { type: 'textarea', rows: 4, span: 'full', required: true }),
        f('consolidacion', 'Consolidación', 'Consolidation', { type: 'textarea', rows: 3, span: 'full', required: true }),
        f('metacognicion', 'Metacognición', 'Metacognition', { type: 'textarea', rows: 2, span: 'full', required: true }),
      ] },

    { id: 'evidencia', num: '5', short: { es: '5', en: '5' }, title: { es: '5. Evidencia y criterios', en: '5. Evidence and criteria' }, sub: { es: 'Desempeño o producto observable y tres criterios de valoración', en: 'Observable performance or product and three assessment criteria' },
      intro: { es: 'Qué producto o desempeño observable demuestra la competencia y con qué tres criterios se valorará.', en: 'Which observable product or performance demonstrates the competency and the three criteria to assess it.' },
      tip: { es: 'Los tres criterios deben ser observables, distintos entre sí y derivarse de la condición y la finalidad de la competencia.', en: 'The three criteria must be observable, distinct from each other, and derived from the condition and purpose of the competency.' },
      fields: [
        f('evidencia', 'Evidencia', 'Evidence', { type: 'textarea', rows: 3, span: 'full', required: true }),
        f('crit1', 'Criterio 1', 'Criterion 1', { type: 'textarea', rows: 2, span: 'full', required: true }),
        f('crit2', 'Criterio 2', 'Criterion 2', { type: 'textarea', rows: 2, span: 'full', required: true }),
        f('crit3', 'Criterio 3', 'Criterion 3', { type: 'textarea', rows: 2, span: 'full', required: true }),
      ] },

    { id: 'articulacion', num: '6', short: { es: '6', en: '6' }, title: { es: '6. Articulación', en: '6. Articulation' }, sub: { es: 'Asignatura, nivel y vínculo con investigación o vinculación con la sociedad', en: 'Course, level, and link to research or community engagement' },
      intro: { es: 'Dónde se desarrolla la competencia y con qué investigación o vinculación se conecta.', en: 'Where the competency is developed and which research or community engagement it connects to.' },
      tip: { es: 'Precargué asignatura y nivel con tus datos de partida; ajústalos si hace falta. El vínculo debe ser concreto (línea, proyecto, actores).', en: 'I prefilled course and level from your starting data; adjust if needed. The link should be concrete (research line, project, actors).' },
      fields: [
        f('art_asignatura', 'Asignatura', 'Course', { type: 'text', span: 'full', required: true }),
        f('art_nivel', 'Nivel y carrera', 'Level and program', { type: 'text', span: 'full', required: true }),
        f('art_vinculo', 'Vínculo con investigación o vinculación con la sociedad', 'Link to research or community engagement', { type: 'textarea', rows: 3, span: 'full', required: true }),
      ] },

    { id: 'revision', short: { es: 'Revisión', en: 'Review' }, title: { es: 'Revisión final de coherencia', en: 'Final coherence review' },
      intro: { es: 'La IA revisa toda la ficha como un conjunto: si los componentes se sostienen entre sí y qué conviene mejorar. Tú decides qué cambiar.', en: 'The AI reviews the whole sheet as a unit: whether components support each other and what to improve. You decide what to change.' } },
    { id: 'exportar', short: { es: 'Exportar', en: 'Export' }, title: { es: 'Tu ficha de competencia', en: 'Your competency sheet' },
      intro: { es: 'Así queda tu ficha en el formato del Anexo B. Cópiala o descárgala.', en: 'This is your sheet in the Annex B format. Copy or download it.' } },
  ];
  const AI_STEPS = STEPS.filter((s) => P.pasos[s.id]).map((s) => s.id);
  const idx = (id) => STEPS.findIndex((s) => s.id === id);

  /* ---------- Estado (guardado solo en este navegador) ---------- */
  let S = { step: 0, data: {} };
  try { const raw = JSON.parse(ST.LS.get(SKEY, 'null')); if (raw && raw.data) S = { step: Math.min(raw.step || 0, STEPS.length - 1), data: raw.data }; } catch (e) { /* estado nuevo */ }
  const fb = {}; // retroalimentación de la IA por paso (solo en memoria)
  let busy = false, abort = null, saveTimer = 0;
  const save = () => ST.LS.set(SKEY, JSON.stringify(S));
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); };
  const val = (id) => String(S.data[id] || '').trim();
  const stepDone = (s) => !s.fields || s.fields.filter((x) => x.required).every((x) => val(x.id));
  const stepStarted = (s) => !!s.fields && s.fields.some((x) => val(x.id));

  /* ---------- Contexto y llamadas a la IA ---------- */
  const fieldsText = (s) => s.fields.filter((x) => val(x.id)).map((x) => `${x.label.es}: ${val(x.id)}`).join('\n');
  const startText = () => fieldsText(STEPS[0]) || '(sin datos)';
  const prevText = (i) => STEPS.slice(1, i).filter((s) => s.fields && stepStarted(s)).map((s) => `## ${s.title.es}\n${fieldsText(s)}`).join('\n\n') || '(todavía ninguno)';
  const fill = (tpl, o) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (o[k] !== undefined ? o[k] : ''));
  const sys = () => fill(P.base, { idioma: ST.lang === 'en' ? 'inglés' : 'español' });

  async function runAI(kind, host, userText) {
    if (busy) return;
    busy = true; abort = new AbortController(); setBusy(true);
    const out = host; out.classList.remove('hidden');
    let shown = '';
    out.innerHTML = '<div class="md-out st-cursor">…</div>';
    const key = S.step;
    try {
      const r = await ST.access.generate({
        system: sys(), messages: [{ role: 'user', text: userText }], temperature: 0.5, signal: abort.signal,
        onChunk: (_, full) => { shown = full; const m = out.querySelector('.md-out'); if (m) m.innerHTML = ST.mdToHtml(full); },
      });
      fb[kind] = r.text;
      if (r.finish && !['STOP'].includes(r.finish)) fb[kind] += `\n\n> ${ST.t(['MAX_TOKENS', 'CUT'].includes(r.finish) ? 'truncated' : 'stopped').replace('{r}', r.finish)}`;
    } catch (e) {
      if (e.name === 'AbortError') fb[kind] = shown ? shown + '\n\n> ' + T('Detenido.', 'Stopped.') : '';
      else fb[kind] = '';
      if (e.name !== 'AbortError') showError(e.message);
    } finally {
      busy = false; abort = null; setBusy(false);
      if (S.step === key || kind === 'revision') paintFeedback(kind);
    }
  }

  function showError(msg) { const e = document.getElementById('cp-error'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } }
  function clearError() { const e = document.getElementById('cp-error'); if (e) e.classList.add('hidden'); }
  function setBusy(b) {
    document.querySelectorAll('.cp-ai').forEach((x) => { x.disabled = b; });
    document.querySelectorAll('.cp-nav').forEach((x) => { x.disabled = b; });
    const stop = document.getElementById('cp-stop'); if (stop) stop.classList.toggle('hidden', !b);
    const sp = document.getElementById('cp-spin'); if (sp) sp.classList.toggle('hidden', !b);
  }
  function paintFeedback(kind) {
    const h = document.getElementById('cp-fb'); if (!h) return;
    if (fb[kind]) { h.classList.remove('hidden'); h.innerHTML = `<div class="md-out">${ST.mdToHtml(fb[kind])}</div>`; } else if (!busy) h.classList.add('hidden');
  }

  function askStep(mode) {
    const s = STEPS[S.step], pr = P.pasos[s.id];
    clearError();
    const draft = fieldsText(s);
    if (mode === 'revision' && !draft) { showError(T('Escribe primero un borrador para que la IA lo revise. Si no sabes por dónde empezar, pide una pista.', 'Write a draft first so the AI can review it. If you do not know where to start, ask for a hint.')); return; }
    ST.access.ensureReady(() => {
      const modo = fill(P.modos[mode], { paso: pr.nombre, criterios: pr.criterios });
      const text = `${modo}\n\nDATOS DE PARTIDA:\n${startText()}\n\nPASOS YA COMPLETADOS POR EL DOCENTE:\n${prevText(S.step)}\n\nBORRADOR DEL DOCENTE PARA "${pr.nombre}":\n${draft || '(vacío)'}`;
      runAI(s.id, document.getElementById('cp-fb'), text);
    });
  }

  function askCoherence() {
    clearError();
    ST.access.ensureReady(() => {
      const ficha = window.Ficha.toText(window.Ficha.build(S.data, 'es'));
      runAI('revision', document.getElementById('cp-fb'), fill(P.coherencia, { contexto: `DATOS DE PARTIDA:\n${startText()}\n\n${ficha}` }));
    });
  }

  /* ---------- Render ---------- */
  const shell = ST.shell({});
  function fieldHtml(x) {
    const v = S.data[x.id] || '', full = x.span === 'full' || x.type === 'textarea';
    const lab = ST.t(x.label) + (x.required ? ' *' : '');
    const ph = esc(ST.t(x.placeholder) || '');
    const inp = x.type === 'textarea'
      ? `<textarea class="st-input" data-f="${x.id}" rows="${x.rows || 4}" placeholder="${ph}">${esc(v)}</textarea>`
      : `<input class="st-input" type="text" data-f="${x.id}" value="${esc(v)}" placeholder="${ph}">`;
    return `<div class="${full ? 'md:col-span-2' : ''}"><label class="st-label">${esc(lab)}</label>${inp}${x.hint ? `<p class="st-hint">${esc(ST.t(x.hint))}</p>` : ''}</div>`;
  }

  const exampleHtml = (id) => {
    const ex = P.ejemplos[id]; if (!ex) return '';
    const md = ex.replace(/\n(?!\s*(?:[-*]|\d+\.)\s)/g, '\n\n');
    return `<details class="mt-4 rounded-lg border p-3" style="border-color:var(--border);background:var(--muted)"><summary class="text-sm font-semibold cursor-pointer">${esc(T('Ver cómo luce en un ejemplo del taller (Ingeniería Civil · Tecnologías del Hormigón)', 'See how it looks in a workshop example (Civil Engineering · Concrete Technology)'))}</summary><div class="md-out mt-2">${ST.mdToHtml(md)}</div><p class="st-hint">${esc(T('Es solo una referencia de formato: redacta lo tuyo con tus propias palabras.', 'This is only a format reference: write your own in your own words.'))}</p></details>`;
  };

  function stepper() {
    return `<div class="no-print"><div class="flex items-center justify-between text-sm mb-1" style="color:var(--muted-foreground)"><span>${esc(T('Paso', 'Step'))} ${S.step + 1} ${esc(T('de', 'of'))} ${STEPS.length}</span><span>${esc(ST.t(STEPS[S.step].title))}</span></div>
      <div class="h-1.5 rounded-full mb-3" style="background:var(--border)"><div class="h-1.5 rounded-full" style="background:var(--primary);width:${((S.step + 1) / STEPS.length) * 100}%"></div></div>
      <div class="flex gap-2 overflow-x-auto pb-2" style="-webkit-overflow-scrolling:touch">${STEPS.map((s, i) => `<button type="button" class="st-btn st-btn-sm cp-nav ${i === S.step ? 'st-btn-primary' : ''}" style="flex:0 0 auto" data-go="${i}" aria-label="${esc(ST.t(s.title))}">${s.fields && stepDone(s) && i !== S.step ? '✓ ' : ''}${esc(ST.t(s.short))}</button>`).join('')}</div></div>`;
  }

  function aiBlock(s) {
    return `<div class="flex flex-wrap items-center gap-2 mt-5 no-print">
        <button type="button" class="st-btn cp-ai" id="cp-hint">💡 ${esc(T('Dame una pista', 'Give me a hint'))}</button>
        <button type="button" class="st-btn st-btn-primary cp-ai" id="cp-review">🔍 ${esc(T('Revisar mi borrador', 'Review my draft'))}</button>
        <span class="st-spin hidden" id="cp-spin" style="border-color:rgba(6,182,212,.3);border-top-color:var(--primary)"></span>
        <button type="button" class="st-btn hidden" id="cp-stop">${esc(ST.t('stop'))}</button>
      </div>
      <div id="cp-error" class="st-error mt-3 hidden"></div>
      <div id="cp-fb" class="mt-3 rounded-lg border p-4 ${fb[s.id] ? '' : 'hidden'}" style="border-color:rgba(6,182,212,.35);background:rgba(6,182,212,.05)"></div>`;
  }

  function reviewBody() {
    const rows = STEPS.filter((s) => s.fields && s.id !== 'inicio').map((s) => `<li class="flex items-center gap-2 text-sm py-1"><span>${stepDone(s) ? '✅' : '⬜'}</span><span class="mr-auto">${esc(ST.t(s.title))}</span><button type="button" class="st-btn st-btn-sm cp-nav" data-go="${idx(s.id)}">${esc(T('Ir', 'Go'))}</button></li>`).join('');
    return `<ul class="mt-2">${rows}</ul>
      <div class="flex flex-wrap items-center gap-2 mt-4 no-print">
        <button type="button" class="st-btn st-btn-primary cp-ai" id="cp-coh">🧭 ${esc(T('Analizar la coherencia de mi ficha', 'Analyze my sheet’s coherence'))}</button>
        <span class="st-spin hidden" id="cp-spin" style="border-color:rgba(6,182,212,.3);border-top-color:var(--primary)"></span>
        <button type="button" class="st-btn hidden" id="cp-stop">${esc(ST.t('stop'))}</button>
      </div>
      <div id="cp-error" class="st-error mt-3 hidden"></div>
      <div id="cp-fb" class="mt-3 rounded-lg border p-4 ${fb.revision ? '' : 'hidden'}" style="border-color:rgba(6,182,212,.35);background:rgba(6,182,212,.05)"></div>`;
  }

  function exportBody() {
    const fi = window.Ficha.build(S.data, ST.lang);
    const missing = STEPS.filter((s) => s.fields && !stepDone(s)).map((s) => ST.t(s.title));
    return `${missing.length ? `<div class="st-notice mb-4 no-print">${esc(T('Aún faltan campos por completar: ', 'Some fields are still empty: '))}${esc(missing.join(' · '))}</div>` : ''}
      <div class="flex flex-wrap gap-2 mb-4 no-print">
        <button type="button" class="st-btn" id="cp-copy">📋 ${esc(ST.t('copy'))}</button>
        <button type="button" class="st-btn st-btn-primary" id="cp-docx">⬇ Word (.docx)</button>
        <button type="button" class="st-btn" id="cp-pdf">🖨 PDF</button>
        <button type="button" class="st-btn cp-nav" data-go="${idx('revision')}">${esc(T('Volver a la revisión', 'Back to review'))}</button>
      </div>
      <p class="st-hint mb-3 no-print">${esc(T('Para el PDF, en el cuadro de impresión elige «Guardar como PDF».', 'For the PDF, choose “Save as PDF” in the print dialog.'))}</p>
      <div id="ficha-doc"><h2 class="font-bold text-lg mb-2">${esc(fi.title)}</h2><div style="overflow-x:auto">${window.Ficha.toHtml(fi)}</div></div>
      <div id="cp-error" class="st-error mt-3 hidden"></div>`;
  }

  function prefillArticulacion() {
    if (!val('art_asignatura') && val('asignatura')) S.data.art_asignatura = S.data.asignatura;
    if (!val('art_nivel') && (val('nivel') || val('carrera'))) S.data.art_nivel = [val('nivel'), val('carrera') ? T('carrera de ', 'program: ') + val('carrera') : ''].filter(Boolean).join(', ');
  }

  function render() {
    const main = shell();
    const s = STEPS[S.step];
    document.title = T('Guía para construir competencias', 'Competency-building guide') + ' — Sornoza.com';
    if (s.id === 'articulacion') prefillArticulacion();
    const isExport = s.id === 'exportar';
    const body = s.fields
      ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">${s.fields.map(fieldHtml).join('')}</div>${s.compose ? `<div class="mt-3 no-print"><button type="button" class="st-btn st-btn-sm" id="cp-compose">✍ ${esc(T('Armar un primer borrador con mis partes', 'Assemble a first draft from my parts'))}</button></div>` : ''}${P.pasos[s.id] ? aiBlock(s) + exampleHtml(s.id) : ''}`
      : s.id === 'revision' ? reviewBody() : exportBody();
    main.innerHTML = `
      <main class="container mx-auto max-w-4xl px-4 md:px-8 py-8">
        <div class="mb-5 no-print">
          <a href="${ST.BASE}" class="text-sm sm:hidden" style="color:var(--muted-foreground)">← ${esc(ST.t('catalog'))}</a>
          <h1 class="text-2xl md:text-3xl font-bold mt-1 flex items-center gap-2"><i data-lucide="compass" class="h-7 w-7" style="color:var(--primary)"></i>${esc(T('Guía para construir competencias', 'Competency-building guide'))}</h1>
          <p class="mt-2" style="color:var(--muted-foreground)">${esc(T('Te acompaño paso a paso con preguntas y retroalimentación para que construyas tu ficha de competencia (Anexo B). Tú escribes; la IA guía y revisa.', 'I guide you step by step with questions and feedback so you build your competency sheet (Annex B). You write; the AI guides and reviews.'))}</p>
        </div>
        <div class="st-notice mb-4 no-print" data-key-notice>${esc(ST.t('need_key'))} <button class="underline font-semibold" id="st-open-key">${esc(ST.t('key_set'))}</button></div>
        <div class="st-card p-4 md:p-5 mb-4">${stepper()}</div>
        <section class="st-card p-5 md:p-6" id="cp-card">
          <h2 class="text-xl font-bold ${isExport ? 'no-print' : ''}">${esc(ST.t(s.title))}</h2>
          ${s.sub ? `<p class="text-sm italic ${isExport ? 'no-print' : ''}" style="color:var(--muted-foreground)">${esc(ST.t(s.sub))}</p>` : ''}
          <p class="mt-2 ${isExport ? 'no-print' : ''}">${esc(ST.t(s.intro))}</p>
          ${s.tip ? `<div class="st-beta mt-3 no-print">💡 ${esc(ST.t(s.tip))}</div>` : ''}
          ${body}
          <div class="flex flex-wrap items-center justify-between gap-2 mt-6 pt-4 border-t no-print" style="border-color:var(--border)">
            <button type="button" class="st-btn cp-nav" data-go="${S.step - 1}" ${S.step === 0 ? 'disabled' : ''}>← ${esc(T('Anterior', 'Back'))}</button>
            ${S.step < STEPS.length - 1 ? `<button type="button" class="st-btn st-btn-primary cp-nav" data-go="${S.step + 1}">${esc(T('Siguiente', 'Next'))} →</button>` : `<button type="button" class="st-btn" id="cp-reset">${esc(T('Empezar una ficha nueva', 'Start a new sheet'))}</button>`}
          </div>
        </section>
        <p class="st-hint mt-3 no-print">${esc(T('Tu progreso se guarda automáticamente en este navegador. Lo que escribes se envía a Google (Gemini) con tu API Key solo cuando pides una pista o una revisión. La IA puede equivocarse: la decisión y la autoría son tuyas.', 'Your progress is saved automatically in this browser. What you write is sent to Google (Gemini) with your API key only when you ask for a hint or a review. The AI can be wrong: decisions and authorship are yours.'))}</p>
      </main>`;
    bind();
    if (fb[s.id]) paintFeedback(s.id); else if (s.id === 'revision' && fb.revision) paintFeedback('revision');
    ST.updateKeyUi && ST.updateKeyUi();
    ST.refreshIcons();
    setBusy(busy);
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length || busy) return;
    save(); S.step = i; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bind() {
    const root = document.getElementById('st-main');
    const key = document.getElementById('st-open-key'); if (key) key.onclick = () => ST.openKeyModal();
    root.querySelectorAll('[data-f]').forEach((el) => { el.addEventListener('input', () => { S.data[el.dataset.f] = el.value; saveSoon(); }); });
    root.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(Number(b.dataset.go))));
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on('cp-hint', () => askStep('pista'));
    on('cp-review', () => askStep('revision'));
    on('cp-coh', askCoherence);
    on('cp-stop', () => abort && abort.abort());
    on('cp-compose', () => {
      const parts = ['verbo', 'objeto', 'condicion', 'finalidad'].map(val);
      if (!parts[0] || !parts[1]) { showError(T('Completa al menos el verbo y el objeto para armar un borrador.', 'Fill in at least the verb and the object to assemble a draft.')); return; }
      if (val('competencia') && !confirm(T('Ya hay una competencia redactada. ¿Reemplazarla con un borrador armado desde tus partes?', 'A written competency already exists. Replace it with a draft assembled from your parts?'))) return;
      const pur = parts[3] ? (/^(para|to|so as to)\s/i.test(parts[3]) ? parts[3] : T('para ', 'to ') + parts[3]) : '';
      S.data.competencia = [parts[0] + ' ' + parts[1], parts[2], pur].filter(Boolean).join(', ') + '.';
      save(); render();
    });
    on('cp-copy', async (e) => { const b = e.currentTarget, old = b.innerHTML; const ok = await window.Ficha.copy(window.Ficha.build(S.data, ST.lang)); b.textContent = ok ? ST.t('copied') : T('No se pudo copiar', 'Could not copy'); setTimeout(() => (b.innerHTML = old), 1600); });
    on('cp-docx', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { await window.Ficha.toDocx(window.Ficha.build(S.data, ST.lang), 'ficha-competencia-' + (val('asignatura').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'borrador') + '.docx'); }
      catch (err) { showError(T('No se pudo generar el Word: ', 'Could not generate the Word file: ') + err.message); }
      b.disabled = false;
    });
    on('cp-pdf', () => window.print());
    on('cp-reset', () => { if (confirm(T('¿Borrar la ficha actual de este navegador y empezar de nuevo?', 'Delete the current sheet from this browser and start over?'))) { S = { step: 0, data: {} }; Object.keys(fb).forEach((k) => delete fb[k]); save(); render(); } });
  }

  ST.onLang(render);
  document.documentElement.lang = ST.lang;
  render();
})();
