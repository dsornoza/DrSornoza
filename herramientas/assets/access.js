/*
 * Capa de acceso a la IA — único punto por donde las herramientas guiadas piden texto al modelo.
 *
 * HOY (modo 'own-key'): cada docente usa su propia API key de Gemini, guardada solo en su navegador
 * (ST.getKey / ST.openKeyModal / ST.gemini, definidos en core.js).
 *
 * MÁS ADELANTE (modo 'account'): para pasar a "gratis con cuenta y cuota" basta con reemplazar el
 * cuerpo de isReady(), ensureReady(), generate() y describe() de este archivo (p. ej. iniciar sesión y
 * llamar a un proxy con control de cuota). Las herramientas que solo usan ST.access no cambian.
 *
 * Contrato (no cambiar al migrar):
 *   ST.access.describe()            -> { mode, ready, label:{es,en}, usage? }   // para mostrar el estado en pantalla
 *   ST.access.isReady()             -> boolean
 *   ST.access.ensureReady(onReady)  -> si no hay acceso, abre el flujo de configuración y llama onReady() al terminar
 *   ST.access.generate({ system, messages:[{role:'user'|'model', text}] | prompt, temperature, signal, onChunk(chunk, fullText) })
 *                                   -> Promise<{ text, finish }>; lanza Error con mensaje legible para el docente
 *   ST.access.openSetup(onDone)     -> abre la pantalla para configurar el acceso (hoy: modal de la API key; después: cuenta/cuota)
 *   ST.access.refreshUi()           -> actualiza el botón del encabezado y los avisos de "falta configurar acceso" de la página
 *
 * Regla: las herramientas y páginas NO llaman a ST.gemini, ST.getKey, ST.openKeyModal ni ST.updateKeyUi; solo a ST.access.
 * (Esas funciones, definidas en core.js, son el controlador de "key propia" que este módulo usa por dentro.)
 * Cada página debe cargar este archivo justo después de core.js.
 */
(function () {
  'use strict';
  const ST = window.ST;
  if (!ST) throw new Error('access.js debe cargarse después de core.js');

  ST.access = {
    mode: 'own-key',

    isReady() { return !!ST.getKey(); },

    describe() {
      const ready = this.isReady();
      return {
        mode: this.mode,
        ready,
        label: ready
          ? { es: 'Usando tu API Key de Gemini', en: 'Using your Gemini API key' }
          : { es: 'Falta configurar tu API Key de Gemini', en: 'Your Gemini API key is not set yet' },
      };
    },

    ensureReady(onReady) {
      if (this.isReady()) { onReady && onReady(); return; }
      ST.openKeyModal(() => { if (this.isReady()) onReady && onReady(); });
    },

    generate(opts) {
      return ST.gemini(opts);
    },

    openSetup(onDone) { ST.openKeyModal(onDone); },

    refreshUi() { ST.updateKeyUi && ST.updateKeyUi(); },
  };
})();
