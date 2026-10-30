/*
 * Modelo de la ficha (Anexo B) y exportaciones: vista HTML, texto, portapapeles, Word (.docx) y PDF (impresión).
 * Una sola función, buildFicha(), define filas y contenido; todos los formatos salen de ella.
 */
(function () {
  'use strict';
  const ST = window.ST;
  const esc = ST.esc;

  const LABELS = {
    es: {
      title: 'Anexo B. Ficha de formación de una competencia', field: 'CAMPO', dev: 'DESARROLLO', empty: '—',
      model: 'Competencia del Modelo (Tabla 1, p. 101)', evidence: 'Evidencia', criteria: 'Criterios de valoración',
      subject: 'Asignatura', level: 'Nivel', link: 'Vínculo',
      phases: { anticipacion: 'Anticipación', construccion: 'Construcción', consolidacion: 'Consolidación', metacognicion: 'Metacognición' },
      rows: {
        competencia: ['1. Competencia', 'Verbo de actuación + objeto + condición + finalidad'],
        conocimientos: ['2a. Conocimientos', 'Lo que se debe saber y comprender'],
        capacidades: ['2b. Capacidades', 'Potencial para actuar ante lo nuevo'],
        habilidades: ['2c. Habilidades', 'Acciones y procedimientos por dominar'],
        valores: ['2d. Valores', 'Sentido ético y social de la actuación'],
        situacion: ['3. Situación profesional', 'Problema real del contexto donde se pone en acto'],
        estrategia: ['4. Estrategia formativa', 'Metodología del Modelo y actividades de anticipación, construcción y consolidación'],
        evidencia: ['5. Evidencia y criterios', 'Desempeño o producto observable y tres criterios de valoración'],
        articulacion: ['6. Articulación', 'Asignatura, nivel y vínculo con investigación o vinculación con la sociedad'],
      },
    },
    en: {
      title: 'Annex B. Competency development sheet', field: 'FIELD', dev: 'DEVELOPMENT', empty: '—',
      model: 'Model competency (Table 1, p. 101)', evidence: 'Evidence', criteria: 'Assessment criteria',
      subject: 'Course', level: 'Level', link: 'Link',
      phases: { anticipacion: 'Anticipation', construccion: 'Construction', consolidacion: 'Consolidation', metacognicion: 'Metacognition' },
      rows: {
        competencia: ['1. Competency', 'Action verb + object + condition + purpose'],
        conocimientos: ['2a. Knowledge', 'What must be known and understood'],
        capacidades: ['2b. Capacities', 'Potential to act in new situations'],
        habilidades: ['2c. Skills', 'Actions and procedures to master'],
        valores: ['2d. Values', 'Ethical and social meaning of the action'],
        situacion: ['3. Professional situation', 'Real problem of the context where the competency is enacted'],
        estrategia: ['4. Learning strategy', 'Model methodology and anticipation, construction and consolidation activities'],
        evidencia: ['5. Evidence and criteria', 'Observable performance or product and three assessment criteria'],
        articulacion: ['6. Articulation', 'Course, level, and link to research or community engagement'],
      },
    },
  };

  const lines = (s) => String(s || '').split('\n').map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, '').trim()).filter(Boolean);
  const clean = (s) => String(s || '').trim();

  // blocks: {t:'p', text} | {t:'ul', items} | {t:'ol', items} | {t:'kv', k, v}
  function buildFicha(d, lang) {
    const L = LABELS[lang] || LABELS.es;
    const p = (text) => ({ t: 'p', text: clean(text) || L.empty });
    const list = (s) => { const it = lines(s); return it.length ? { t: 'ul', items: it } : p(''); };
    const kv = (k, v) => ({ t: 'kv', k, v: clean(v) || L.empty });

    const comp = [p(d.competencia)];
    if (clean(d.modelo)) comp.push(p(L.model + ': ' + clean(d.modelo)));

    const cons = L.phases.construccion + (clean(d.metodologia) ? ' (' + clean(d.metodologia) + ')' : '');
    const crit = [d.crit1, d.crit2, d.crit3].map(clean).filter(Boolean);
    const rows = {
      competencia: comp,
      conocimientos: [list(d.conocimientos)],
      capacidades: [list(d.capacidades)],
      habilidades: [list(d.habilidades)],
      valores: [list(d.valores)],
      situacion: [p(d.situacion)],
      estrategia: [kv(L.phases.anticipacion, d.anticipacion), kv(cons, d.construccion), kv(L.phases.consolidacion, d.consolidacion), kv(L.phases.metacognicion, d.metacognicion)],
      evidencia: [kv(L.evidence, d.evidencia), { t: 'p', text: L.criteria + ':', bold: true }, crit.length ? { t: 'ol', items: crit } : p('')],
      articulacion: [kv(L.subject, d.art_asignatura), kv(L.level, d.art_nivel), kv(L.link, d.art_vinculo)],
    };
    return {
      title: L.title, head: [L.field, L.dev],
      rows: Object.keys(L.rows).map((id) => ({ id, label: L.rows[id][0], sub: L.rows[id][1], blocks: rows[id] })),
    };
  }

  function blockHtml(b) {
    if (b.t === 'ul') return '<ul>' + b.items.map((i) => `<li>${esc(i)}</li>`).join('') + '</ul>';
    if (b.t === 'ol') return '<ol>' + b.items.map((i) => `<li>${esc(i)}</li>`).join('') + '</ol>';
    if (b.t === 'kv') return `<p><strong>${esc(b.k)}:</strong> ${esc(b.v)}</p>`;
    return `<p>${b.bold ? '<strong>' + esc(b.text) + '</strong>' : esc(b.text)}</p>`;
  }

  // Tabla HTML con estilos en línea (se pega bien en Word/Docs y sirve para la vista previa y la impresión)
  function toHtml(f) {
    const cell = 'border:1px solid #94a3b8;padding:6px 9px;vertical-align:top;font-size:11pt;';
    return `<table style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif" class="ficha-table">
<thead><tr><th style="${cell}background:#e2e8f0;text-align:left;width:28%">${esc(f.head[0])}</th><th style="${cell}background:#e2e8f0;text-align:left">${esc(f.head[1])}</th></tr></thead><tbody>
${f.rows.map((r) => `<tr><td style="${cell}"><strong>${esc(r.label)}</strong><br><em style="font-size:9.5pt;color:#475569">${esc(r.sub)}</em></td><td style="${cell}">${r.blocks.map(blockHtml).join('')}</td></tr>`).join('\n')}
</tbody></table>`;
  }

  function toText(f) {
    const out = [f.title.toUpperCase(), ''];
    f.rows.forEach((r) => {
      out.push(r.label.toUpperCase() + ' — ' + r.sub);
      r.blocks.forEach((b) => {
        if (b.t === 'ul') b.items.forEach((i) => out.push('- ' + i));
        else if (b.t === 'ol') b.items.forEach((i, n) => out.push((n + 1) + '. ' + i));
        else if (b.t === 'kv') out.push(b.k + ': ' + b.v);
        else out.push(b.text);
      });
      out.push('');
    });
    return out.join('\n').trim() + '\n';
  }

  async function copy(f) {
    const text = toText(f), html = `<h2>${esc(f.title)}</h2>` + toHtml(f);
    try {
      if (window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
        return true;
      }
    } catch (e) { /* se intenta solo texto */ }
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  const DOCX_URL = 'https://cdn.jsdelivr.net/npm/docx@7.8.2/build/index.js';
  async function toDocx(f, filename) {
    if (!window.docx) await ST.loadScript(DOCX_URL);
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType } = window.docx;
    const W = [2700, 6938]; // A4 con márgenes de 2 cm (DXA)
    const border = { style: 'single', size: 4, color: '94A3B8' };
    const borders = { top: border, bottom: border, left: border, right: border };
    const margins = { top: 80, bottom: 80, left: 120, right: 120 };
    const run = (text, o) => new TextRun({ text, font: 'Calibri', size: 22, ...(o || {}) });
    const para = (runs, o) => new Paragraph({ children: runs, spacing: { after: 80 }, ...(o || {}) });
    const cell = (children, w, shade) => new TableCell({
      children, width: { size: w, type: WidthType.DXA }, borders, margins,
      ...(shade ? { shading: { type: ShadingType.CLEAR, fill: shade, color: 'auto' } } : {}),
    });
    const blockToParas = (b) => {
      if (b.t === 'ul') return b.items.map((i) => para([run(i)], { bullet: { level: 0 } }));
      if (b.t === 'ol') return b.items.map((i, n) => para([run((n + 1) + '. ' + i)], { indent: { left: 360, hanging: 360 } }));
      if (b.t === 'kv') return [para([run(b.k + ': ', { bold: true }), run(b.v)])];
      return [para([run(b.text, b.bold ? { bold: true } : {})])];
    };
    const rows = [new TableRow({ tableHeader: true, children: f.head.map((h, i) => cell([para([run(h, { bold: true })])], W[i], 'E2E8F0')) })]
      .concat(f.rows.map((r) => new TableRow({
        cantSplit: false,
        children: [
          cell([para([run(r.label, { bold: true })], { spacing: { after: 20 } }), para([run(r.sub, { italics: true, size: 19, color: '475569' })])], W[0]),
          cell([].concat(...r.blocks.map(blockToParas)), W[1]),
        ],
      })));
    const doc = new Document({
      creator: 'sornoza.com', title: f.title,
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: [
          new Paragraph({ children: [run(f.title, { bold: true, size: 28 })], alignment: AlignmentType.LEFT, spacing: { after: 200 } }),
          new Table({ width: { size: W[0] + W[1], type: WidthType.DXA }, columnWidths: W, rows }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  window.Ficha = { build: buildFicha, toHtml, toText, copy, toDocx, lines };
})();
