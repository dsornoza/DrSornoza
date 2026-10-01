/*
 * Núcleo de /herramientas — sitio estático, sin backend.
 *   - Idioma ES/EN, API key de Gemini del propio usuario (localStorage), cliente Gemini con streaming
 *   - Markdown seguro → HTML / LaTeX / Excel, historial local, lectura de PDF/Word/Excel en el navegador
 *   - ST.mountTool(config): construye formulario + salida + historial a partir de una definición declarativa
 *
 * Definición de herramienta (config):
 *   { id, title:{es,en}, desc:{es,en}, icon,
 *     fields:[{id, type:'text|textarea|number|select|file|checkboxes|custom', label:{es,en}, hint, placeholder,
 *              options:[{value,label:{es,en}}], required, default, span:'full', accept, min, max, rows,
 *              render(el, ctx) / get() / validate()   // solo para type:'custom'
 *            }],
 *     buildPrompt(values, ctx) -> {system, prompt, preface?, title?}   // puede ser async
 *   }
 */
(function () {
  'use strict';
  const ST = (window.ST = {});

  /* ================= Utilidades ================= */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* almacenamiento bloqueado */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } },
  };
  ST.LS = LS;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  ST.esc = esc;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const sleep = (ms, signal) => new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); });
  });
  const slug = (s) => String(s || 'resultado').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'resultado';
  const BASE = (() => { // ruta del directorio /herramientas/ (para enlaces desde páginas anidadas)
    const m = location.pathname.match(/^(.*?\/herramientas\/)/);
    return m ? m[1] : '/herramientas/';
  })();
  ST.BASE = BASE;

  ST.linkEncode = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  ST.linkDecode = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));

  /* ================= Idioma ================= */
  ST.lang = LS.get('sornoza_lang') || ((navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es');
  const langListeners = [];
  ST.onLang = (fn) => langListeners.push(fn);
  ST.setLang = (l) => {
    ST.lang = l;
    LS.set('sornoza_lang', l);
    document.documentElement.lang = l;
    langListeners.forEach((fn) => fn(l));
  };

  const S = {
    catalog: { es: 'Catálogo', en: 'Catalog' },
    site: { es: 'Herramientas IA para docentes', en: 'AI tools for educators' },
    key_set: { es: 'Configurar API Key', en: 'Set API key' },
    key_ok: { es: 'API Key lista', en: 'API key ready' },
    key_title: { es: 'Tu API Key de Gemini', en: 'Your Gemini API key' },
    key_desc: { es: 'Las herramientas usan tu propia cuenta de Google. La key se guarda solo en este navegador y se envía únicamente a Google.', en: 'The tools use your own Google account. The key is stored only in this browser and is sent only to Google.' },
    key_get: { es: 'Obtén una key gratuita en Google AI Studio', en: 'Get a free key at Google AI Studio' },
    key_ph: { es: 'Pega aquí tu API Key (AIza…)', en: 'Paste your API key here (AIza…)' },
    key_save: { es: 'Guardar', en: 'Save' },
    key_remove: { es: 'Quitar key', en: 'Remove key' },
    key_close: { es: 'Cerrar', en: 'Close' },
    model: { es: 'Modelo de Gemini', en: 'Gemini model' },
    model_custom: { es: 'Otro (escribir nombre)…', en: 'Other (type name)…' },
    model_hint: { es: 'Si Google retira un modelo, la página busca otro automáticamente. También puedes detectar los disponibles para tu key.', en: 'If Google retires a model, the page finds another one automatically. You can also detect the ones available for your key.' },
    model_detect: { es: 'Detectar modelos disponibles', en: 'Detect available models' },
    model_detecting: { es: 'Consultando a Google…', en: 'Asking Google…' },
    model_found: { es: '{n} modelos disponibles para tu key. Elige uno y pulsa Guardar.', en: '{n} models available for your key. Pick one and press Save.' },
    model_none: { es: 'Google no devolvió modelos compatibles para esta key.', en: 'Google returned no compatible models for this key.' },
    model_switched: { es: 'El modelo anterior ya no está disponible. Se cambió automáticamente a {m}.', en: 'The previous model is no longer available. Switched automatically to {m}.' },
    need_key: { es: 'Para usar esta herramienta necesitas tu API Key de Gemini (gratuita).', en: 'To use this tool you need your (free) Gemini API key.' },
    generate: { es: 'Generar', en: 'Generate' },
    generating: { es: 'Generando…', en: 'Generating…' },
    stop: { es: 'Detener', en: 'Stop' },
    copy: { es: 'Copiar', en: 'Copy' },
    copied: { es: '¡Copiado!', en: 'Copied!' },
    preview: { es: 'Vista previa', en: 'Preview' },
    edit: { es: 'Editar', en: 'Edit' },
    result: { es: 'Resultado', en: 'Result' },
    out_lang: { es: 'Idioma del resultado', en: 'Output language' },
    privacy: { es: 'Lo que escribas o subas se envía a Google (Gemini) usando tu key. No incluyas datos personales identificables sin autorización. Revisa siempre el resultado: la IA puede equivocarse.', en: 'What you type or upload is sent to Google (Gemini) using your key. Do not include identifiable personal data without permission. Always review the output: AI can make mistakes.' },
    history: { es: 'Historial (guardado en este navegador)', en: 'History (stored in this browser)' },
    history_empty: { es: 'Aún no hay resultados guardados.', en: 'No saved results yet.' },
    hist_export: { es: 'Exportar JSON', en: 'Export JSON' },
    hist_import: { es: 'Importar JSON', en: 'Import JSON' },
    hist_clear: { es: 'Borrar historial', en: 'Clear history' },
    hist_confirm: { es: '¿Borrar todo el historial de esta herramienta?', en: 'Delete all history for this tool?' },
    restore: { es: 'Abrir', en: 'Open' },
    missing: { es: 'Completa los campos obligatorios:', en: 'Please fill the required fields:' },
    upload: { es: 'Subir archivo', en: 'Upload file' },
    remove_file: { es: 'Quitar', en: 'Remove' },
    reading: { es: 'Leyendo archivo…', en: 'Reading file…' },
    file_err: { es: 'No se pudo leer el archivo', en: 'Could not read the file' },
    file_trunc: { es: 'Se usaron los primeros {n} caracteres del archivo.', en: 'Only the first {n} characters of the file were used.' },
    stopped: { es: 'Gemini detuvo la respuesta antes de terminar (motivo: {r}). El resultado puede estar incompleto: genera de nuevo o reformula el contenido.', en: 'Gemini stopped the response early (reason: {r}). The result may be incomplete: generate again or rephrase the content.' },
    truncated: { es: 'La respuesta quedó incompleta (límite de longitud o conexión cortada), aun después de pedir que continuara. Genera de nuevo o hazlo por partes.', en: 'The response was left incomplete (length limit or dropped connection) even after asking it to continue. Generate again or do it in parts.' },
    err_no_key: { es: 'Configura primero tu API Key de Gemini.', en: 'Set your Gemini API key first.' },
    err_key: { es: 'Google rechazó la API Key. Revisa que esté completa y activa.', en: 'Google rejected the API key. Check that it is complete and active.' },
    err_busy: { es: 'Los modelos de Gemini tienen alta demanda en este momento (es temporal). Espera un minuto e inténtalo de nuevo.', en: 'Gemini models are under high demand right now (this is temporary). Wait a minute and try again.' },
    model_trying: { es: 'El modelo {a} está saturado o sin cuota. Probando con {b}…', en: 'Model {a} is overloaded or out of quota. Trying {b}…' },
    err_quota: { es: 'Se alcanzó el límite de uso gratuito de Gemini. Espera un momento o cambia de modelo (p. ej. flash-lite).', en: 'The free Gemini usage limit was reached. Wait a moment or switch model (e.g. flash-lite).' },
    err_model: { es: 'Ese modelo no está disponible para tu key. Abre la configuración de la API Key y pulsa «Detectar modelos disponibles».', en: 'That model is not available for your key. Open the API key settings and press “Detect available models”.' },
    err_net: { es: 'No se pudo conectar con Gemini. Revisa tu conexión.', en: 'Could not reach Gemini. Check your connection.' },
    err_blocked: { es: 'Gemini bloqueó la respuesta por sus filtros de seguridad. Reformula el contenido.', en: 'Gemini blocked the response with its safety filters. Rephrase the content.' },
    err_empty: { es: 'Gemini no devolvió texto. Intenta de nuevo.', en: 'Gemini returned no text. Try again.' },
    tex_note: { es: 'Documento LaTeX completo; si lo vas a incluir en un libro o tesis, copia solo el cuerpo.', en: 'Full LaTeX document; if it goes into a book or thesis, copy only the body.' },
    footer: { es: 'Las herramientas funcionan en tu navegador con tu propia API Key de Gemini.', en: 'These tools run in your browser with your own Gemini API key.' },
  };
  ST.t = (x) => (typeof x === 'string' ? (S[x] ? S[x][ST.lang] || S[x].es : x) : x ? x[ST.lang] || x.es || '' : '');
  const langName = (l) => (l === 'en' ? 'English' : 'español');

  /* ================= Catálogo de herramientas ================= */
  ST.CATEGORIES = [
    { id: 'plan', icon: 'calendar-days', label: { es: 'Planeación', en: 'Planning' } },
    { id: 'eval', icon: 'clipboard-check', label: { es: 'Evaluación', en: 'Assessment' } },
    { id: 'thesis', icon: 'graduation-cap', label: { es: 'Tesis y artículos', en: 'Theses & papers' } },
    { id: 'data', icon: 'bar-chart-3', label: { es: 'Análisis de datos', en: 'Data analysis' } },
    { id: 'student', icon: 'users', label: { es: 'Para estudiantes', en: 'For students' } },
  ];
  ST.TOOLS = [
    { id: 'plan-clase', cat: 'plan', icon: 'layout-list', ready: true,
      title: { es: 'Plan de clase', en: 'Lesson plan' },
      desc: { es: 'Sesión completa con resultados de aprendizaje, cronograma, actividades activas y evaluación formativa.', en: 'A complete session with learning outcomes, timeline, active-learning activities and formative assessment.' } },
    { id: 'rubricas', cat: 'eval', icon: 'table-properties', ready: true,
      title: { es: 'Generador de rúbricas', en: 'Rubric generator' },
      desc: { es: 'Rúbricas analíticas, holísticas o listas de cotejo, con pesos y puntajes; exportables a Excel y LaTeX.', en: 'Analytic or holistic rubrics and checklists with weights and scores; exportable to Excel and LaTeX.' } },
    { id: 'encuestas', cat: 'data', icon: 'activity', ready: true, badge: { es: 'Cálculo en tu navegador', en: 'Computed in your browser' },
      title: { es: 'Análisis de encuestas Likert', en: 'Likert survey analysis' },
      desc: { es: 'Sube tu Excel o CSV: fiabilidad (α de Cronbach), correlaciones y comparaciones de grupos calculadas con código, y la IA redacta la sección de resultados.', en: 'Upload your Excel or CSV: reliability (Cronbach\'s α), correlations and group comparisons are computed in code, and AI drafts the results section.' } },
    { id: 'tutor', cat: 'student', icon: 'messages-square', ready: true, badge: { es: 'Enlace para tus estudiantes', en: 'Link for your students' },
      title: { es: 'Tutor socrático', en: 'Socratic tutor' },
      desc: { es: 'Crea un enlace a un tutor de IA que guía con preguntas y pistas, sin resolver la tarea. El estudiante usa su propia key de Gemini.', en: 'Create a link to an AI tutor that guides with questions and hints without solving the task. Students use their own Gemini key.' } },
    { id: 'borrador', cat: 'student', icon: 'file-pen-line', ready: true, badge: { es: 'Enlace para tus estudiantes', en: 'Link for your students' },
      title: { es: 'Evaluador de borradores', en: 'Draft feedback' },
      desc: { es: 'Crea un enlace donde el estudiante pega su borrador y recibe retroalimentación formativa según tu rúbrica, sin que la IA reescriba su texto.', en: 'Create a link where students paste a draft and get formative feedback against your rubric, without the AI rewriting their text.' } },
    { id: 'silabo', cat: 'plan', icon: 'book-open', ready: true, title: { es: 'Sílabo', en: 'Syllabus' }, desc: { es: 'Sílabo alineado a resultados de aprendizaje.', en: 'Syllabus aligned to learning outcomes.' } },
    { id: 'resultados', cat: 'plan', icon: 'target', ready: true, title: { es: 'Resultados de aprendizaje', en: 'Learning outcomes' }, desc: { es: 'Redacción medible con taxonomía de Bloom.', en: 'Measurable outcomes using Bloom\'s taxonomy.' } },
    { id: 'banco-preguntas', cat: 'eval', icon: 'list-checks', ready: true, title: { es: 'Banco de preguntas', en: 'Question bank' }, desc: { es: 'Opción múltiple y casos con retroalimentación.', en: 'Multiple choice and case items with feedback.' } },
    { id: 'retroalimentacion', cat: 'eval', icon: 'message-square-text', ready: true, title: { es: 'Retroalimentación a trabajos', en: 'Feedback on student work' }, desc: { es: 'Comentarios según tu rúbrica.', en: 'Comments based on your rubric.' } },
    { id: 'matriz-consistencia', cat: 'thesis', icon: 'grid-3x3', ready: true, title: { es: 'Matriz de consistencia', en: 'Consistency matrix' }, desc: { es: 'Problema, objetivos, hipótesis y método alineados.', en: 'Aligned problem, objectives, hypotheses and method.' } },
    { id: 'ecuacion-busqueda', cat: 'thesis', icon: 'search', ready: true, title: { es: 'Ecuación de búsqueda', en: 'Search string' }, desc: { es: 'Scopus y Web of Science con sinónimos y operadores.', en: 'Scopus and Web of Science with synonyms and operators.' } },
    { id: 'revisor-redaccion', cat: 'thesis', icon: 'pen-line', ready: true, title: { es: 'Revisor de redacción académica', en: 'Academic writing reviewer' }, desc: { es: 'Claridad, coherencia y estilo APA 7 en avances de tesis.', en: 'Clarity, coherence and APA 7 style in thesis drafts.' } },
  ];

  /* ================= API Key y modelo ================= */
  const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
  const EXCLUDE = /(image|tts|embedding|live|audio|robotics|computer|native|aqa|learnlm|gemma|imagen|veo|thinking-exp)/i;
  // Puntaje para elegir el mejor modelo de texto: Flash estable > Flash-Lite > Pro; versión más alta; evita preview/exp
  const modelScore = (id) => {
    if (EXCLUDE.test(id)) return -1;
    const v = id.match(/gemini-(\d+(?:\.\d+)?)/);
    return (/lite/.test(id) ? 200 : /flash/.test(id) ? 300 : /pro/.test(id) ? 100 : 0) + (v ? parseFloat(v[1]) * 10 : 0) - (/preview|exp/.test(id) ? 50 : 0);
  };
  const pickModel = (ids, current) => ids.filter((id) => id !== current && modelScore(id) >= 0).sort((a, b) => modelScore(b) - modelScore(a))[0] || null;
  ST.toast = (msg) => {
    const d = document.createElement('div');
    d.className = 'st-ok'; d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;right:1rem;bottom:1rem;max-width:22rem;z-index:200;box-shadow:var(--shadow-elevated)';
    d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 8000);
  };
  // Lista los modelos que la key del usuario puede usar con generateContent
  ST.listModels = async function (key, signal) {
    const ids = []; let token = '';
    for (let i = 0; i < 5; i++) {
      let res;
      try { res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers: { 'x-goog-api-key': key }, signal }); }
      catch (e) { if (e.name === 'AbortError') throw e; throw new Error(ST.t('err_net')); }
      if (!res.ok) {
        let msg = ''; try { msg = (await res.json()).error.message || ''; } catch (e) { /* sin cuerpo */ }
        throw new Error([400, 401, 403].includes(res.status) ? ST.t('err_key') : msg || 'HTTP ' + res.status);
      }
      const j = await res.json();
      (j.models || []).forEach((m) => { if ((m.supportedGenerationMethods || []).includes('generateContent') && /^models\/gemini-/.test(m.name)) ids.push(m.name.replace(/^models\//, '')); });
      token = j.nextPageToken; if (!token) break;
    }
    return ids;
  };
  ST.getKey = () => LS.get('gemini_key', '') || ''; // misma clave que usa recursos/titulos
  ST.getModel = () => LS.get('st_model', MODELS[0]);

  function openKeyModal(onDone) {
    const cur = ST.getModel();
    const isCustom = !MODELS.includes(cur);
    const bg = document.createElement('div');
    bg.className = 'st-modal-bg';
    bg.innerHTML = `
      <div class="st-modal" role="dialog" aria-modal="true">
        <h2 class="text-lg font-bold mb-1">${esc(ST.t('key_title'))}</h2>
        <p class="text-sm mb-3" style="color:var(--muted-foreground)">${esc(ST.t('key_desc'))}</p>
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-sm font-semibold underline" style="color:var(--primary-dark)">${esc(ST.t('key_get'))} ↗</a>
        <input id="st-key" type="password" autocomplete="off" class="st-input mt-3" placeholder="${esc(ST.t('key_ph'))}" value="${esc(ST.getKey())}">
        <label class="st-label mt-3">${esc(ST.t('model'))}</label>
        <select id="st-model" class="st-input">
          ${MODELS.map((m) => `<option value="${m}" ${m === cur ? 'selected' : ''}>${m}</option>`).join('')}
          <option value="__custom" ${isCustom ? 'selected' : ''}>${esc(ST.t('model_custom'))}</option>
        </select>
        <input id="st-model-custom" class="st-input mt-2 ${isCustom ? '' : 'hidden'}" placeholder="gemini-…" value="${isCustom ? esc(cur) : ''}">
        <button type="button" class="st-btn st-btn-sm mt-2" id="st-detect">${esc(ST.t('model_detect'))}</button>
        <p class="st-hint" id="st-model-msg">${esc(ST.t('model_hint'))}</p>
        <div class="flex flex-wrap gap-2 mt-4 justify-end">
          <button class="st-btn" id="st-key-remove">${esc(ST.t('key_remove'))}</button>
          <button class="st-btn" id="st-key-close">${esc(ST.t('key_close'))}</button>
          <button class="st-btn st-btn-primary" id="st-key-save">${esc(ST.t('key_save'))}</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    const sel = $('#st-model', bg), custom = $('#st-model-custom', bg);
    sel.onchange = () => custom.classList.toggle('hidden', sel.value !== '__custom');
    const msg = $('#st-model-msg', bg);
    $('#st-detect', bg).onclick = async () => {
      const k = $('#st-key', bg).value.trim() || ST.getKey();
      msg.style.color = ''; msg.textContent = ST.t('model_detecting');
      try {
        const ids = (await ST.listModels(k)).filter((id) => modelScore(id) >= 0).sort((a, b) => modelScore(b) - modelScore(a));
        if (!ids.length) throw new Error(ST.t('model_none'));
        const chosen = sel.value === '__custom' ? custom.value.trim() : sel.value, keep = ids.includes(chosen) ? chosen : ids[0];
        sel.innerHTML = ids.map((m) => `<option value="${esc(m)}" ${m === keep ? 'selected' : ''}>${esc(m)}</option>`).join('') + `<option value="__custom">${esc(ST.t('model_custom'))}</option>`;
        custom.classList.add('hidden');
        msg.textContent = ST.t('model_found').replace('{n}', ids.length);
      } catch (e) { msg.style.color = '#991b1b'; msg.textContent = e.message; }
    };
    $('#st-key-close', bg).onclick = close;
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    $('#st-key-remove', bg).onclick = () => { LS.del('gemini_key'); close(); updateKeyButtons(); onDone && onDone(); };
    $('#st-key-save', bg).onclick = () => {
      const k = $('#st-key', bg).value.trim();
      if (k) LS.set('gemini_key', k);
      const m = sel.value === '__custom' ? custom.value.trim() : sel.value;
      if (m) LS.set('st_model', m);
      close(); updateKeyButtons(); onDone && onDone();
    };
    $('#st-key', bg).focus();
  }
  ST.openKeyModal = openKeyModal;

  function updateKeyButtons() {
    const ok = !!ST.getKey();
    document.querySelectorAll('[data-key-btn]').forEach((b) => {
      b.innerHTML = `<span style="display:inline-block;width:.5rem;height:.5rem;border-radius:50%;background:${ok ? '#22c55e' : '#f59e0b'}"></span> ${esc(ST.t(ok ? 'key_ok' : 'key_set'))}`;
    });
    document.querySelectorAll('[data-key-notice]').forEach((n) => n.classList.toggle('hidden', ok));
  }

  ST.updateKeyUi = updateKeyButtons;

  /* ================= Estructura de página (header/footer) ================= */
  ST.shell = function (opts) {
    opts = opts || {};
    const render = () => {
      document.body.innerHTML = `
        <header class="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur no-print" style="border-color:var(--border)">
          <div class="container mx-auto flex h-16 items-center justify-between gap-3 px-4 md:px-8">
            <a href="${opts.student ? '/' : BASE}" class="flex items-center gap-2 min-w-0">
              <img src="/assets/logo-mark.png" alt="" class="h-7 w-auto">
              <span class="text-sm md:text-base font-semibold truncate">${esc(opts.student ? ST.t({ es: 'Herramienta de estudio con IA', en: 'AI study tool' }) : ST.t('site'))}</span>
            </a>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${opts.catalog || opts.student ? '' : `<a href="${BASE}" class="hidden sm:inline text-sm font-medium" style="color:var(--muted-foreground)">← ${esc(ST.t('catalog'))}</a>`}
              <button class="st-btn st-btn-sm" id="st-lang" title="Language / Idioma">${ST.lang === 'es' ? 'EN' : 'ES'}</button>
              ${opts.noKey ? '' : '<button class="st-btn st-btn-sm" data-key-btn></button>'}
            </div>
          </div>
        </header>
        <div id="st-main"></div>
        <footer class="py-8 px-4 border-t text-center text-sm no-print" style="border-color:var(--border);color:var(--muted-foreground);background:#fff;margin-top:3rem">
          ${esc(ST.t('footer'))}<br>&copy; ${new Date().getFullYear()} Dr. Diego Sornoza Parrales — <a href="/" class="hover:underline" style="color:var(--primary)">sornoza.com</a>
        </footer>`;
      $('#st-lang').onclick = () => ST.setLang(ST.lang === 'es' ? 'en' : 'es');
      document.querySelectorAll('[data-key-btn]').forEach((b) => (b.onclick = () => openKeyModal()));
      updateKeyButtons();
      return $('#st-main');
    };
    return render;
  };

  function refreshIcons() { if (window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons(); } catch (e) { /* ignore */ } } }
  ST.refreshIcons = refreshIcons;

  /* ================= Cargador de librerías perezoso ================= */
  const loaded = {};
  ST.loadScript = (url) => loaded[url] || (loaded[url] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = res; s.onerror = () => { delete loaded[url]; rej(new Error('No se pudo cargar ' + url)); };
    document.head.appendChild(s);
  }));
  const LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  };

  /* ================= Lectura de archivos en el navegador ================= */
  const MAX_CHARS = 150000;
  ST.readTable = async function (file) {
    await ST.loadScript(LIBS.xlsx);
    const ext = file.name.split('.').pop().toLowerCase();
    let wb;
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
      const text = await file.text();
      const first = text.split('\n')[0] || '';
      const counts = { ',': (first.match(/,/g) || []).length, ';': (first.match(/;/g) || []).length, '\t': (first.match(/\t/g) || []).length };
      const FS = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      wb = XLSX.read(text, { type: 'string', FS });
    } else {
      wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    }
    return wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }),
    })).filter((s) => s.rows.length > 1);
  };

  ST.readFile = async function (file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let text = '';
    if (['txt', 'md', 'csv', 'tsv', 'tex', 'json'].includes(ext)) {
      text = await file.text();
    } else if (ext === 'docx') {
      await ST.loadScript(LIBS.mammoth);
      text = (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } else if (ext === 'pdf') {
      await ST.loadScript(LIBS.pdf);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const parts = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        parts.push(c.items.map((it) => it.str).join(' '));
        if (parts.join('\n').length > MAX_CHARS) break;
      }
      text = parts.join('\n\n');
    } else if (['xlsx', 'xls'].includes(ext)) {
      await ST.loadScript(LIBS.xlsx);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      text = wb.SheetNames.map((n) => '## ' + n + '\n' + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n\n');
    } else {
      throw new Error('.' + ext);
    }
    text = text.replace(/\u0000/g, '').trim();
    const truncated = text.length > MAX_CHARS;
    return { name: file.name, text: truncated ? text.slice(0, MAX_CHARS) : text, truncated };
  };

  /* ================= Cliente Gemini (streaming) ================= */
  const apiErr = (code, extra) => { const e = new Error(ST.t('err_' + code) + (extra ? ' (' + extra + ')' : '')); e.code = code; return e; };

  ST.gemini = async function ({ system, prompt, messages, temperature = 0.6, signal, onChunk }) {
    const key = ST.getKey();
    if (!key) throw apiErr('no_key');
    let model = ST.getModel(), switched = false, knownIds = null;
    const tried = new Set([model]);
    const urlFor = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`;
    let url = urlFor(model);
    const base = messages ? messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })) : [{ role: 'user', parts: [{ text: prompt }] }];
    let contents = base, total = '', cont = 0;
    // El límite incluye el "pensamiento" interno de los modelos 2.5/3+; los antiguos no admiten más de 8192
    const maxTok = (m) => (/gemini-(2\.5|[3-9])|latest/.test(m) ? 32768 : 8192);
    const bodyFor = () => JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTok(model) },
    });
    const CONTINUE = 'Continue exactly where your previous message stopped. Do not repeat anything already written and do not add any preface or comment: write the very next characters of the same document.';

    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: bodyFor(), signal });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw apiErr('net');
      }
      if (!res.ok) {
        if ((res.status === 429 || res.status === 503) && attempt < 2) { await sleep(2500 * (attempt + 1), signal); continue; }
        if ((res.status === 429 || res.status === 503) && tried.size < 4) {
          // Saturado o sin cuota tras reintentar: la demanda y la cuota son por modelo, así que probamos otro (sin guardarlo)
          if (!knownIds) { try { knownIds = await ST.listModels(key, signal); } catch (e) { if (e.name === 'AbortError') throw e; knownIds = []; } }
          const alt = knownIds.filter((id) => !tried.has(id) && modelScore(id) >= 0).sort((a, b) => modelScore(b) - modelScore(a))[0];
          if (alt) {
            ST.toast(ST.t('model_trying').replace('{a}', model).replace('{b}', alt));
            tried.add(alt); model = alt; url = urlFor(alt); attempt = 1; continue; // un solo intento más por modelo alterno
          }
        }
        let msg = '';
        try { msg = (await res.json()).error.message || ''; } catch (e) { /* sin cuerpo */ }
        if (res.status === 429) throw apiErr('quota');
        if (res.status === 503) throw apiErr('busy');
        if (res.status === 404) {
          // El modelo ya no existe para esta key: buscamos uno vigente, lo guardamos y reintentamos una vez
          if (!switched) {
            switched = true;
            let alt = null;
            try { alt = pickModel(await ST.listModels(key, signal), model); } catch (e) { if (e.name === 'AbortError') throw e; }
            if (alt) { model = alt; url = urlFor(alt); LS.set('st_model', alt); ST.toast(ST.t('model_switched').replace('{m}', alt)); continue; }
          }
          throw apiErr('model', model);
        }
        if (res.status === 401 || res.status === 403 || /API key/i.test(msg)) throw apiErr('key');
        const e = new Error(msg || 'HTTP ' + res.status); e.code = 'http'; throw e;
      }

      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '', full = '', finish = null;
      const handle = (line) => {
        if (!line.startsWith('data:')) return;
        const js = line.slice(5).trim();
        if (!js || js === '[DONE]') return;
        let o; try { o = JSON.parse(js); } catch (e) { return; }
        if (o.promptFeedback && o.promptFeedback.blockReason) throw apiErr('blocked');
        const c = o.candidates && o.candidates[0];
        const t = c && c.content && c.content.parts ? c.content.parts.map((p) => p.text || '').join('') : '';
        if (t) { full += t; onChunk && onChunk(t, total + full); }
        if (c && c.finishReason) finish = c.finishReason;
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); }
        }
        if (buf) handle(buf.replace(/\r$/, ''));
      } catch (e) {
        if (e.name === 'AbortError' || e.code === 'blocked') throw e;
        // conexión cortada a mitad de respuesta: se trata como respuesta incompleta (finish = null)
      }
      if (!full && !total) throw apiErr(finish === 'SAFETY' ? 'blocked' : 'empty');
      total += full;
      // Respuesta incompleta (límite de tokens o corte de conexión): pedimos al modelo que continúe, hasta 2 veces
      const cut = finish === 'MAX_TOKENS' || !finish;
      if (cut && full && cont < 2) {
        cont++; contents = base.concat([{ role: 'model', parts: [{ text: total }] }, { role: 'user', parts: [{ text: CONTINUE }] }]);
        attempt = -1; continue;
      }
      return { text: total, finish: finish || 'CUT' };
    }
  };

  /* ================= Markdown: analizador común ================= */
  function parseMd(src) {
    const lines = String(src || '').replace(/\r/g, '').split('\n'), blocks = [];
    const isSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
    const splitRow = (s) => { s = s.trim(); if (s.startsWith('|')) s = s.slice(1); if (s.endsWith('|')) s = s.slice(0, -1); return s.split('|').map((c) => c.trim()); };
    const isList = (l) => /^\s*([-*+]|\d+[.)])\s+/.test(l);
    const startsBlock = (l, nxt) => /^\s*$/.test(l) || /^(#{1,6})\s/.test(l) || /^```/.test(l) || isList(l) || /^\s*>/.test(l) || (l.includes('|') && nxt !== undefined && isSep(nxt));
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      let m;
      if (/^\s*$/.test(l)) { i++; continue; }
      if (/^```/.test(l)) {
        const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; blocks.push({ t: 'code', text: buf.join('\n') }); continue;
      }
      if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { blocks.push({ t: 'h', l: m[1].length, text: m[2].trim() }); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { blocks.push({ t: 'hr' }); i++; continue; }
      if (l.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
        const rows = [splitRow(l)]; i += 2;
        while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]));
        blocks.push({ t: 'table', rows }); continue;
      }
      if (/^\s*>/.test(l)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        blocks.push({ t: 'quote', text: buf.join(' ') }); continue;
      }
      if (isList(l)) {
        const items = [];
        while (i < lines.length && (isList(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
          const mm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (mm) items.push({ depth: Math.min(2, Math.floor(mm[1].length / 2)), ordered: /\d/.test(mm[2]), text: mm[3] });
          else items[items.length - 1].text += ' ' + lines[i].trim();
          i++;
        }
        blocks.push({ t: 'list', items }); continue;
      }
      const buf = [];
      while (i < lines.length && !startsBlock(lines[i], lines[i + 1]) ) buf.push(lines[i++].trim());
      if (!buf.length) { buf.push(lines[i++].trim()); }
      blocks.push({ t: 'p', text: buf.join(' ') });
    }
    return blocks;
  }
  ST.parseMd = parseMd;

  /* ---- Markdown → HTML (se escapa todo el HTML antes de formatear) ---- */
  function inlineHtml(s) {
    let h = esc(s);
    h = h.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return h;
  }
  ST.mdToHtml = function (src) {
    return parseMd(src).map((b) => {
      switch (b.t) {
        case 'h': return `<h${Math.min(b.l, 6)}>${inlineHtml(b.text)}</h${Math.min(b.l, 6)}>`;
        case 'p': return `<p>${inlineHtml(b.text)}</p>`;
        case 'hr': return '<hr>';
        case 'quote': return `<blockquote>${inlineHtml(b.text)}</blockquote>`;
        case 'code': return `<pre><code>${esc(b.text)}</code></pre>`;
        case 'table': {
          const [head, ...body] = b.rows;
          return `<div class="tbl-wrap"><table><thead><tr>${head.map((c) => `<th>${inlineHtml(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${head.map((_, i) => `<td>${inlineHtml(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        }
        case 'list': {
          let out = '', stack = [];
          b.items.forEach((it) => {
            const tag = it.ordered ? 'ol' : 'ul';
            while (stack.length < it.depth + 1) { out += `<${tag}>`; stack.push(tag); }
            while (stack.length > it.depth + 1) out += `</${stack.pop()}>`;
            out += `<li>${inlineHtml(it.text)}</li>`;
          });
          while (stack.length) out += `</${stack.pop()}>`;
          return out;
        }
        default: return '';
      }
    }).join('\n');
  };

  /* ---- Markdown → LaTeX ---- */
  const TEXMAP = { 'α': '$\\alpha$', 'β': '$\\beta$', 'ρ': '$\\rho$', 'η': '$\\eta$', 'χ': '$\\chi$', 'ω': '$\\omega$', 'λ': '$\\lambda$', 'μ': '$\\mu$', 'σ': '$\\sigma$', '≥': '$\\geq$', '≤': '$\\leq$', '≠': '$\\neq$', '≈': '$\\approx$', '±': '$\\pm$', '×': '$\\times$', '–': '--', '—': '---', '²': '\\textsuperscript{2}', '³': '\\textsuperscript{3}', '…': '\\ldots{}', '→': '$\\rightarrow$', '“': '``', '”': "''", '’': "'", '‘': '`', '†': '\\dag{}', '▍': '' };
  const texEsc = (s) => s.replace(/[\\&%$#_{}~^]/g, (c) => ({ '\\': '\\textbackslash{}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' }[c] || '\\' + c)).replace(/[αβρηχωλμσ≥≤≠≈±×–—²³…→“”’‘†▍]/g, (c) => TEXMAP[c]);
  function inlineTex(s, inTable) {
    return s.split(/(\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*|`[^`]+`|\[[^\]]+\]\(https?:[^)\s]+\)|<br\s*\/?>)/gi).map((p) => {
      let m;
      if (!p) return '';
      if (/^<br/i.test(p)) return inTable ? '\\newline{}' : '\\\\';
      if ((m = p.match(/^\*\*([^*]+)\*\*$/))) return '\\textbf{' + inlineTex(m[1], inTable) + '}';
      if ((m = p.match(/^\*([^*]+)\*$/))) return '\\textit{' + inlineTex(m[1], inTable) + '}';
      if ((m = p.match(/^`([^`]+)`$/))) return '\\texttt{' + texEsc(m[1]) + '}';
      if ((m = p.match(/^\[([^\]]+)\]\((https?:[^)\s]+)\)$/))) return '\\href{' + m[2].replace(/([%#&_])/g, '\\$1') + '}{' + texEsc(m[1]) + '}';
      return texEsc(p);
    }).join('');
  }
  ST.mdToTex = function (src, title) {
    const body = parseMd(src).map((b) => {
      switch (b.t) {
        case 'h': return `\\${['section*', 'subsection*', 'subsubsection*', 'paragraph*'][Math.min(b.l, 4) - 1]}{${inlineTex(b.text)}}`;
        case 'p': return inlineTex(b.text) + '\n';
        case 'hr': return '\\medskip\\hrule\\medskip';
        case 'quote': return `\\begin{quote}\n${inlineTex(b.text)}\n\\end{quote}`;
        case 'code': return `\\begin{verbatim}\n${b.text.replace(/\\end\{verbatim\}/g, '')}\n\\end{verbatim}`;
        case 'table': {
          const [head, ...rows] = b.rows, n = head.length;
          const w = (0.94 / n).toFixed(3);
          const spec = '|' + head.map(() => `>{\\raggedright\\arraybackslash}p{${w}\\linewidth}|`).join('');
          const row = (r) => head.map((_, i) => inlineTex(r[i] || '', true)).join(' & ') + ' \\\\ \\hline';
          return `{\\small\n\\begin{longtable}{${spec}}\n\\hline\n${head.map((c) => '\\textbf{' + inlineTex(c, true) + '}').join(' & ')} \\\\ \\hline\n\\endhead\n${rows.map(row).join('\n')}\n\\end{longtable}\n}`;
        }
        case 'list': {
          let out = '', stack = [];
          b.items.forEach((it) => {
            const env = it.ordered ? 'enumerate' : 'itemize';
            while (stack.length < it.depth + 1) { out += `\\begin{${env}}\n`; stack.push(env); }
            while (stack.length > it.depth + 1) out += `\\end{${stack.pop()}}\n`;
            out += `\\item ${inlineTex(it.text)}\n`;
          });
          while (stack.length) out += `\\end{${stack.pop()}}\n`;
          return out;
        }
        default: return '';
      }
    }).join('\n\n');
    const babel = ST.lang === 'en' ? 'english' : 'spanish';
    return `% ${ST.t('tex_note')}
\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[${babel}]{babel}
\\usepackage[a4paper,margin=2.2cm]{geometry}
\\usepackage{array,longtable,hyperref}
\\title{${inlineTex(title || '')}}
\\date{}
\\begin{document}
${title ? '\\maketitle\n' : ''}
${body}

\\end{document}
`;
  };

  /* ---- Tablas Markdown → Excel ---- */
  ST.exportXlsx = async function (src, name) {
    await ST.loadScript(LIBS.xlsx);
    const tables = parseMd(src).filter((b) => b.t === 'table');
    if (!tables.length) return false;
    const wb = XLSX.utils.book_new();
    const clean = (c) => {
      const v = String(c).replace(/<br\s*\/?>/gi, '\n').replace(/\*\*|`/g, '').replace(/(^|\s)\*|\*(\s|$)/g, '$1$2').trim();
      return /^-?(\d+([.,]\d+)?|\.\d+)$/.test(v) ? Number(v.replace(',', '.')) : v;
    };
    tables.forEach((t, i) => {
      const ws = XLSX.utils.aoa_to_sheet(t.rows.map((r) => r.map(clean)));
      ws['!cols'] = t.rows[0].map((_, c) => ({ wch: Math.min(60, Math.max(10, ...t.rows.map((r) => String(r[c] || '').length))) }));
      XLSX.utils.book_append_sheet(wb, ws, ('T' + (i + 1)).slice(0, 31));
    });
    XLSX.writeFile(wb, name + '.xlsx');
    return true;
  };

  function download(name, text, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  ST.download = download;

  /* ================= Historial local ================= */
  const HKEY = 'st_history';
  ST.history = {
    all() { try { return JSON.parse(LS.get(HKEY, '[]')) || []; } catch (e) { return []; } },
    save(list) { LS.set(HKEY, JSON.stringify(list.slice(0, 60))); },
    add(item) { const l = this.all(); l.unshift({ id: Date.now().toString(36), ts: Date.now(), ...item }); this.save(l); },
    remove(id) { this.save(this.all().filter((x) => x.id !== id)); },
    clear(tool) { this.save(this.all().filter((x) => x.tool !== tool)); },
    import(text) {
      const incoming = JSON.parse(text);
      if (!Array.isArray(incoming)) throw new Error('JSON');
      const have = new Set(this.all().map((x) => x.id));
      this.save(this.all().concat(incoming.filter((x) => x && x.id && x.tool && !have.has(x.id))).sort((a, b) => b.ts - a.ts));
    },
  };

  /* ================= Panel de salida ================= */
  function createOutput(host, o) {
    let text = o.text || '', mode = 'preview', streaming = false, raf = 0;
    host.innerHTML = `
      <div class="st-card">
        <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b no-print" style="border-color:var(--border)">
          <h2 class="font-bold mr-auto">${esc(ST.t('result'))}</h2>
          <button class="st-btn st-btn-sm" data-a="mode"></button>
          <button class="st-btn st-btn-sm" data-a="copy">${esc(ST.t('copy'))}</button>
          <button class="st-btn st-btn-sm" data-a="md">.md</button>
          <button class="st-btn st-btn-sm" data-a="tex">.tex</button>
          <button class="st-btn st-btn-sm" data-a="xlsx">.xlsx</button>
        </div>
        <div class="p-5" data-body></div>
      </div>`;
    const body = $('[data-body]', host), modeBtn = $('[data-a=mode]', host);
    const name = () => slug(o.getTitle ? o.getTitle() : 'resultado') + '-' + new Date().toISOString().slice(0, 10);
    const paint = () => {
      modeBtn.textContent = mode === 'preview' ? ST.t('edit') : ST.t('preview');
      modeBtn.disabled = streaming;
      const has = !!text.trim();
      host.querySelectorAll('[data-a=copy],[data-a=md],[data-a=tex]').forEach((b) => (b.disabled = !has || streaming));
      $('[data-a=xlsx]', host).disabled = !has || streaming || !/\n?\s*\|?\s*:?-{2,}:?\s*\|/.test(text);
      if (mode === 'edit' && !streaming) {
        body.innerHTML = '<textarea class="st-input md-edit"></textarea>';
        const ta = $('textarea', body); ta.value = text;
        ta.oninput = () => { text = ta.value; o.onChange && o.onChange(text); };
      } else {
        body.innerHTML = `<div class="md-out ${streaming ? 'st-cursor' : ''}">${ST.mdToHtml(text)}</div>`;
      }
    };
    host.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'mode') { mode = mode === 'preview' ? 'edit' : 'preview'; paint(); }
      if (act === 'copy') { try { await navigator.clipboard.writeText(text); } catch (err) { /* sin permiso */ } a.textContent = ST.t('copied'); setTimeout(() => (a.textContent = ST.t('copy')), 1500); }
      if (act === 'md') download(name() + '.md', text, 'text/markdown;charset=utf-8');
      if (act === 'tex') download(name() + '.tex', ST.mdToTex(text, o.getTitle ? o.getTitle() : ''), 'application/x-tex;charset=utf-8');
      if (act === 'xlsx') { try { await ST.exportXlsx(text, name()); } catch (err) { alert(err.message); } }
    });
    paint();
    return {
      setText(t) { text = t; if (mode === 'edit' && !streaming) { paint(); return; } cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); },
      getText: () => text,
      setStreaming(b) { streaming = b; if (b) mode = 'preview'; cancelAnimationFrame(raf); paint(); },
    };
  }
  ST.createOutput = createOutput;

  /* ================= Montaje de una herramienta ================= */
  ST.mountTool = function (cfg) {
    const state = { values: {}, files: {}, output: '', title: '' };
    try { state.values = JSON.parse(LS.get('st_form_' + cfg.id, '{}')) || {}; } catch (e) { state.values = {}; }
    const customs = {}; // controladores de campos custom (conservan su estado entre re-render)
    let abort = null, out = null, busy = false;

    const shell = ST.shell({ student: !!cfg.student, noKey: !!cfg.local });
    const outLangField = { id: '_lang', type: 'select', label: 'out_lang', options: [{ value: 'es', label: { es: 'Español', en: 'Spanish' } }, { value: 'en', label: { es: 'Inglés', en: 'English' } }] };
    const allFields = () => cfg.fields.concat(cfg.noOutLang ? [] : [outLangField]);
    const valOf = (f) => (state.values[f.id] !== undefined ? state.values[f.id] : f.type === 'checkboxes' ? (f.default || []) : f.id === '_lang' ? ST.lang : f.default !== undefined ? f.default : f.type === 'select' ? optVal(f.options[0]) : '');
    const optVal = (o) => (typeof o === 'string' ? o : o.value);
    const optLabel = (o) => (typeof o === 'string' ? o : ST.t(o.label));
    const saveForm = () => LS.set('st_form_' + cfg.id, JSON.stringify(state.values));

    function fieldHtml(f) {
      const lab = ST.t(f.label) + (f.required ? ' *' : '');
      const hint = f.hint ? `<p class="st-hint">${esc(ST.t(f.hint))}</p>` : '';
      const v = valOf(f);
      const full = f.span === 'full' || ['textarea', 'file', 'checkboxes', 'custom'].includes(f.type);
      let inner = '';
      if (f.type === 'text' || f.type === 'number') inner = `<input class="st-input" type="${f.type}" data-f="${f.id}" value="${esc(v)}" placeholder="${esc(ST.t(f.placeholder) || '')}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''}>`;
      else if (f.type === 'textarea') inner = `<textarea class="st-input" data-f="${f.id}" rows="${f.rows || 4}" placeholder="${esc(ST.t(f.placeholder) || '')}">${esc(v)}</textarea>`;
      else if (f.type === 'select') inner = `<select class="st-input" data-f="${f.id}">${f.options.map((o) => `<option value="${esc(optVal(o))}" ${String(optVal(o)) === String(v) ? 'selected' : ''}>${esc(optLabel(o))}</option>`).join('')}</select>`;
      else if (f.type === 'checkboxes') inner = `<div class="flex flex-wrap gap-x-5 gap-y-2">${f.options.map((o) => `<label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" data-f="${f.id}" data-v="${esc(optVal(o))}" ${(v || []).includes(optVal(o)) ? 'checked' : ''}> ${esc(optLabel(o))}</label>`).join('')}</div>`;
      else if (f.type === 'file') {
        const fl = state.files[f.id];
        inner = `<div class="flex flex-wrap items-center gap-2">
          <label class="st-btn st-btn-sm cursor-pointer"><input type="file" class="hidden" data-file="${f.id}" accept="${esc(f.accept || '.pdf,.docx,.txt,.md,.csv,.xlsx')}"> ${esc(ST.t('upload'))}</label>
          ${fl ? `<span class="text-sm">${esc(fl.name)} <span style="color:var(--muted-foreground)">(${fl.text.length.toLocaleString()} car.)</span></span><button class="st-btn st-btn-sm" data-rmfile="${f.id}">${esc(ST.t('remove_file'))}</button>` : ''}
          <span class="text-xs" data-filemsg="${f.id}" style="color:var(--muted-foreground)">${fl && fl.truncated ? esc(ST.t('file_trunc').replace('{n}', fl.text.length.toLocaleString())) : ''}</span></div>`;
      } else if (f.type === 'custom') inner = `<div data-custom="${f.id}"></div>`;
      return `<div class="${full ? 'md:col-span-2' : ''}">${f.type === 'custom' ? '' : `<label class="st-label">${esc(lab)}</label>`}${inner}${hint}</div>`;
    }

    function render() {
      const main = shell();
      const t = ST.t(cfg.title);
      document.title = t + ' — Sornoza.com';
      const hasFile = cfg.fields.some((f) => f.type === 'file' || f.type === 'custom');
      main.innerHTML = `
        <main class="container mx-auto max-w-4xl px-4 md:px-8 py-8">
          <div class="mb-6">
            ${cfg.student ? '' : `<a href="${BASE}" class="text-sm sm:hidden" style="color:var(--muted-foreground)">← ${esc(ST.t('catalog'))}</a>`}
            <h1 class="text-2xl md:text-3xl font-bold mt-1 flex items-center gap-2"><i data-lucide="${cfg.icon || 'sparkles'}" class="h-7 w-7" style="color:var(--primary)"></i>${esc(t)}</h1>
            <p class="mt-2" style="color:var(--muted-foreground)">${esc(ST.t(cfg.desc))}</p>
          </div>
          ${cfg.notice ? `<div class="st-card p-4 mb-4"><div class="md-out">${ST.mdToHtml(ST.t(cfg.notice))}</div></div>` : ''}
          ${cfg.local ? '' : `<div class="st-notice mb-4" data-key-notice>${esc(ST.t('need_key'))} <button class="underline font-semibold" id="st-open-key">${esc(ST.t('key_set'))}</button></div>`}
          <form class="st-card p-5 md:p-6" id="st-form" novalidate>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${allFields().map(fieldHtml).join('')}</div>
            <div id="st-error" class="st-error mt-4 hidden"></div>
            <div class="flex flex-wrap items-center gap-3 mt-5">
              <button type="submit" class="st-btn st-btn-primary" id="st-go"><span id="st-go-txt">${esc(ST.t(cfg.submitLabel || 'generate'))}</span></button>
              <button type="button" class="st-btn hidden" id="st-stop">${esc(ST.t('stop'))}</button>
            </div>
            <p class="st-hint mt-3">${esc(ST.t(cfg.privacy || 'privacy'))}</p>
          </form>
          <div id="st-out" class="mt-6 ${state.output ? '' : 'hidden'}"></div>
          <details class="st-card mt-6 p-4 no-print" id="st-hist"><summary class="font-semibold cursor-pointer">${esc(ST.t('history'))}</summary><div id="st-hist-body" class="mt-3"></div></details>
        </main>`;
      main.querySelectorAll('[data-custom]').forEach((el) => { const f = cfg.fields.find((x) => x.id === el.dataset.custom); customs[f.id] = customs[f.id] || {}; f.render(el, { lang: ST.lang, state: customs[f.id], t: ST.t }); });
      out = createOutput($('#st-out'), { text: state.output, getTitle: () => state.title || t, onChange: (x) => (state.output = x) });
      updateKeyButtons(); refreshIcons(); bind(); renderHistory(); setBusy(busy);
    }

    function bind() {
      const form = $('#st-form');
      const ok = $('#st-open-key'); if (ok) ok.onclick = () => openKeyModal();
      form.addEventListener('input', (e) => {
        const el = e.target; if (!el.dataset || !el.dataset.f) return;
        if (el.type === 'checkbox') {
          const set = new Set(state.values[el.dataset.f] || valOf(allFields().find((f) => f.id === el.dataset.f)));
          el.checked ? set.add(el.dataset.v) : set.delete(el.dataset.v);
          state.values[el.dataset.f] = [...set];
        } else state.values[el.dataset.f] = el.value;
        saveForm();
      });
      form.addEventListener('change', async (e) => {
        const el = e.target;
        if (el.dataset.f && el.type !== 'checkbox') { state.values[el.dataset.f] = el.value; saveForm(); }
        if (el.dataset.file && el.files[0]) {
          const id = el.dataset.file, msg = $(`[data-filemsg="${id}"]`);
          msg.textContent = ST.t('reading');
          try { state.files[id] = await ST.readFile(el.files[0]); render(); }
          catch (err) { msg.textContent = ST.t('file_err') + ' (' + err.message + ')'; }
        }
      });
      form.addEventListener('click', (e) => {
        const r = e.target.closest('[data-rmfile]'); if (r) { delete state.files[r.dataset.rmfile]; render(); }
      });
      form.addEventListener('submit', (e) => { e.preventDefault(); generate(); });
      $('#st-stop').onclick = () => abort && abort.abort();
    }

    function setBusy(b) {
      busy = b;
      const go = $('#st-go'); if (!go) return;
      go.disabled = b;
      $('#st-go-txt').innerHTML = b ? `<span class="st-spin"></span> ${esc(ST.t('generating'))}` : esc(ST.t(cfg.submitLabel || 'generate'));
      $('#st-stop').classList.toggle('hidden', !b);
    }
    const showError = (m) => { const el = $('#st-error'); if (!el) return; el.textContent = m || ''; el.classList.toggle('hidden', !m); };

    function collect() {
      const v = {};
      allFields().forEach((f) => {
        if (f.type === 'file') v[f.id] = state.files[f.id] || null;
        else if (f.type === 'custom') v[f.id] = customs[f.id] && f.get ? f.get(customs[f.id]) : null;
        else v[f.id] = valOf(f);
      });
      return v;
    }
    function validate(v) {
      const miss = cfg.fields.filter((f) => f.required && f.type !== 'custom' && (f.type === 'file' ? !v[f.id] : Array.isArray(v[f.id]) ? !v[f.id].length : String(v[f.id] == null ? '' : v[f.id]).trim() === ''));
      if (miss.length) return ST.t('missing') + ' ' + miss.map((f) => ST.t(f.label)).join(', ');
      for (const f of cfg.fields) if (f.type === 'custom' && f.validate) { const m = f.validate(customs[f.id], ST.lang); if (m) return m; }
      return '';
    }

    async function generate() {
      showError('');
      if (!cfg.local && !ST.getKey()) { openKeyModal(() => ST.getKey() && generate()); return; }
      const v = collect(), bad = validate(v);
      if (bad) { showError(bad); return; }
      setBusy(true); abort = new AbortController();
      const outLang = v._lang || ST.lang;
      let preface = '', partial = '';
      try {
        const spec = await cfg.buildPrompt(v, { lang: ST.lang, outLang, outLangName: langName(outLang), t: ST.t });
        state.title = spec.title || ST.t(cfg.title);
        if (spec.system) spec.system += '\n\nHeadings: if a section heading appears as "A / B" in these instructions, write ONLY the version in the response language as the heading, never both.';
        if (spec.output !== undefined) { // herramienta local: no llama a Gemini
          state.output = spec.output; $('#st-out').classList.remove('hidden'); out.setText(spec.output);
          $('#st-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        preface = spec.preface ? spec.preface + '\n\n' : '';
        $('#st-out').classList.remove('hidden');
        out.setText(preface); out.setStreaming(true);
        $('#st-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
        const r = await ST.gemini({
          system: spec.system, prompt: spec.prompt, temperature: cfg.temperature === undefined ? 0.6 : cfg.temperature, signal: abort.signal,
          onChunk: (_, full) => { partial = full; out.setText(preface + full); },
        });
        state.output = preface + r.text;
        out.setStreaming(false); out.setText(state.output);
        if (r.finish && r.finish !== 'STOP') showError(ST.t(['MAX_TOKENS', 'CUT'].includes(r.finish) ? 'truncated' : 'stopped').replace('{r}', r.finish));
        saveHistory(v);
      } catch (err) {
        out.setStreaming(false);
        state.output = preface + partial;
        out.setText(state.output);
        if (err.name !== 'AbortError') showError(err.message);
        else if (partial.trim()) saveHistory(v);
      } finally { setBusy(false); abort = null; }
    }

    function saveHistory(v) {
      const plain = {};
      Object.keys(v).forEach((k) => { if (typeof v[k] !== 'object' || Array.isArray(v[k])) plain[k] = v[k]; });
      ST.history.add({ tool: cfg.id, title: state.title, values: plain, output: state.output });
      renderHistory();
    }

    function renderHistory() {
      const box = $('#st-hist-body'); if (!box) return;
      const items = ST.history.all().filter((x) => x.tool === cfg.id);
      box.innerHTML = `
        ${items.length ? `<ul class="divide-y" style="border-color:var(--border)">${items.map((x) => `
          <li class="py-2 flex items-center gap-3"><div class="min-w-0 mr-auto"><div class="text-sm font-semibold truncate">${esc(x.title)}</div><div class="text-xs" style="color:var(--muted-foreground)">${new Date(x.ts).toLocaleString(ST.lang)}</div></div>
          <button class="st-btn st-btn-sm" data-open="${x.id}">${esc(ST.t('restore'))}</button>
          <button class="st-btn st-btn-sm" data-del="${x.id}" aria-label="delete">✕</button></li>`).join('')}</ul>` : `<p class="text-sm" style="color:var(--muted-foreground)">${esc(ST.t('history_empty'))}</p>`}
        <div class="flex flex-wrap gap-2 mt-3">
          <button class="st-btn st-btn-sm" data-hexp>${esc(ST.t('hist_export'))}</button>
          <label class="st-btn st-btn-sm cursor-pointer"><input type="file" accept=".json" class="hidden" data-himp> ${esc(ST.t('hist_import'))}</label>
          ${items.length ? `<button class="st-btn st-btn-sm" data-hclr>${esc(ST.t('hist_clear'))}</button>` : ''}
        </div>`;
      box.onclick = (e) => {
        const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
        if (o) {
          const x = ST.history.all().find((h) => h.id === o.dataset.open);
          if (x) { state.values = { ...state.values, ...x.values }; state.output = x.output; state.title = x.title; saveForm(); render(); $('#st-out').scrollIntoView({ behavior: 'smooth' }); }
        }
        if (d) { ST.history.remove(d.dataset.del); renderHistory(); }
        if (e.target.closest('[data-hexp]')) download('historial-sornoza-herramientas.json', JSON.stringify(ST.history.all(), null, 1), 'application/json');
        if (e.target.closest('[data-hclr]') && confirm(ST.t('hist_confirm'))) { ST.history.clear(cfg.id); renderHistory(); }
      };
      const imp = $('[data-himp]', box);
      imp.onchange = async () => { try { ST.history.import(await imp.files[0].text()); renderHistory(); } catch (err) { alert('JSON inválido / invalid JSON'); } };
    }

    ST.onLang(() => render());
    document.documentElement.lang = ST.lang;
    render();
  };

  /* ================= Catálogo (página principal) ================= */
  ST.mountCatalog = function () {
    const shell = ST.shell({ catalog: true });
    let filter = 'all', query = '';
    const render = () => {
      const main = shell();
      document.title = ST.t('site') + ' — Sornoza.com';
      const list = ST.TOOLS.filter((x) => (filter === 'all' || x.cat === filter) && (!query || (ST.t(x.title) + ' ' + ST.t(x.desc)).toLowerCase().includes(query)));
      const card = (x) => {
        const body = `
          <div class="flex items-start gap-3">
            <div class="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background:var(--muted)"><i data-lucide="${x.icon}" class="h-5 w-5" style="color:var(--primary)"></i></div>
            <div class="min-w-0">
              <h3 class="font-bold leading-snug" style="color:var(--card-foreground)">${esc(ST.t(x.title))}</h3>
              <p class="text-sm mt-1" style="color:var(--muted-foreground)">${esc(ST.t(x.desc))}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span class="st-chip" style="background:rgba(6,182,212,.12);color:var(--primary-dark)">${esc(ST.t(ST.CATEGORIES.find((c) => c.id === x.cat).label))}</span>
                ${x.ready ? '<span class="st-chip text-white" style="background:var(--primary)">IA</span>' : `<span class="st-chip" style="background:var(--muted);color:var(--muted-foreground)">${ST.lang === 'es' ? 'Próximamente' : 'Coming soon'}</span>`}
                ${x.badge ? `<span class="st-chip" style="background:#ecfdf5;color:#047857">${esc(ST.t(x.badge))}</span>` : ''}
              </div>
            </div>
          </div>`;
        return x.ready
          ? `<a href="${BASE}${x.id}/" class="st-card p-5 block transition hover:-translate-y-0.5" style="transition:all .2s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">${body}</a>`
          : `<div class="st-card p-5" style="opacity:.6;border-style:dashed">${body}</div>`;
      };
      main.innerHTML = `
        <section class="bg-white border-b" style="border-color:var(--border)">
          <div class="container mx-auto max-w-5xl px-4 md:px-8 py-12 text-center">
            <h1 class="text-3xl md:text-4xl font-bold mb-3">${esc(ST.t('site'))}</h1>
            <p class="text-lg max-w-2xl mx-auto" style="color:var(--muted-foreground)">${ST.lang === 'es'
              ? 'Planeación, evaluación, dirección de tesis y análisis de datos. Gratis, en tu navegador y con tu propia cuenta de Gemini.'
              : 'Planning, assessment, thesis supervision and data analysis. Free, in your browser and with your own Gemini account.'}</p>
          </div>
        </section>
        <main class="container mx-auto max-w-5xl px-4 md:px-8 py-8">
          <div class="st-notice mb-6 flex flex-wrap items-center gap-3" data-key-notice>
            <span class="mr-auto">${esc(ST.t('need_key'))}</span>
            <button class="st-btn st-btn-sm st-btn-primary" id="st-open-key">${esc(ST.t('key_set'))}</button>
          </div>
          <div class="flex flex-wrap items-center gap-2 mb-6">
            ${[{ id: 'all', label: { es: 'Todas', en: 'All' } }, ...ST.CATEGORIES].map((c) => `<button class="st-btn st-btn-sm ${filter === c.id ? 'st-btn-primary' : ''}" data-cat="${c.id}">${esc(ST.t(c.label))}</button>`).join('')}
            <input id="st-q" class="st-input md:ml-auto" style="max-width:16rem" placeholder="${ST.lang === 'es' ? 'Buscar herramienta…' : 'Search tools…'}" value="${esc(query)}">
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">${list.map(card).join('') || `<p style="color:var(--muted-foreground)">—</p>`}</div>
          <p class="mt-8 text-sm" style="color:var(--muted-foreground)">${ST.lang === 'es' ? 'Más recursos sin IA:' : 'More resources without AI:'} <a class="underline" style="color:var(--primary-dark)" href="/recursos/">/recursos</a></p>
        </main>`;
      $('#st-open-key').onclick = () => openKeyModal();
      main.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { filter = b.dataset.cat; render(); }));
      const q = $('#st-q');
      q.oninput = () => { query = q.value.trim().toLowerCase(); const pos = q.selectionStart; render(); const n = $('#st-q'); n.focus(); n.setSelectionRange(pos, pos); };
      updateKeyButtons(); refreshIcons();
    };
    ST.onLang(render);
    document.documentElement.lang = ST.lang;
    render();
  };
})();
