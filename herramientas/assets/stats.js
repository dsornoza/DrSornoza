/*
 * Motor estadístico determinístico para encuestas Likert.
 * Todos los números se calculan aquí (en el navegador); la IA solo redacta la interpretación.
 * Funciona en navegador (window.LikertStats) y en Node (module.exports) para poder probarlo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LikertStats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Utilidades básicas ---------- */
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : NaN);
  const variance = (a) => {
    if (a.length < 2) return NaN;
    const m = mean(a);
    return sum(a.map((x) => (x - m) * (x - m))) / (a.length - 1);
  };
  const sd = (a) => Math.sqrt(variance(a));

  function ranks(a) {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }

  function tieSum(a) {
    // Σ (t^3 - t) sobre grupos de empates
    const c = {};
    a.forEach((v) => (c[v] = (c[v] || 0) + 1));
    return sum(Object.values(c).map((t) => t * t * t - t));
  }

  /* ---------- Distribuciones (para valores p) ---------- */
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  function betacf(a, b, x) {
    const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
  }

  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      let ap = a, del = 1 / a, s = del;
      for (let n = 0; n < 500; n++) {
        ap++; del *= x / ap; s += del;
        if (Math.abs(del) < Math.abs(s) * 1e-14) break;
      }
      return s * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }

  const pT2 = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5); // dos colas
  const pF = (f, d1, d2) => (f <= 0 ? 1 : ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2)); // cola superior
  const pChi2 = (x, k) => (x <= 0 ? 1 : 1 - gammaP(k / 2, x / 2)); // cola superior
  const pNorm2 = (z) => 1 - gammaP(0.5, (z * z) / 2); // dos colas

  /* ---------- Estadísticos ---------- */
  function pearson(x, y) {
    const mx = mean(x), my = mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
      syy += (y[i] - my) ** 2;
    }
    return sxy / Math.sqrt(sxx * syy);
  }

  function spearman(x, y) {
    const n = x.length;
    if (n < 4) return { rho: NaN, p: NaN, n };
    const rho = pearson(ranks(x), ranks(y));
    if (!isFinite(rho)) return { rho: NaN, p: NaN, n };
    const p = Math.abs(rho) >= 1 ? 0 : pT2((rho * Math.sqrt(n - 2)) / Math.sqrt(1 - rho * rho), n - 2);
    return { rho, p, n };
  }

  // rows: array de arrays (casos × ítems) completos
  function cronbach(rows) {
    const n = rows.length, k = rows[0] ? rows[0].length : 0;
    if (n < 3 || k < 2) return { alpha: NaN, n, k, ifDeleted: [] };
    const alphaOf = (cols) => {
      const kk = cols.length;
      if (kk < 2) return NaN;
      const vi = cols.map((c) => variance(rows.map((r) => r[c])));
      const tot = variance(rows.map((r) => sum(cols.map((c) => r[c]))));
      return tot > 0 ? (kk / (kk - 1)) * (1 - sum(vi) / tot) : NaN;
    };
    const all = [...Array(k).keys()];
    return { alpha: alphaOf(all), n, k, ifDeleted: all.map((c) => alphaOf(all.filter((x) => x !== c))) };
  }

  function welch(a, b) {
    const va = variance(a), vb = variance(b), na = a.length, nb = b.length;
    const se = Math.sqrt(va / na + vb / nb);
    const t = (mean(a) - mean(b)) / se;
    const df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
    const sp = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
    return { t, df, p: pT2(t, df), d: (mean(a) - mean(b)) / sp };
  }

  function mannWhitney(a, b) {
    const na = a.length, nb = b.length, all = a.concat(b), r = ranks(all);
    const R1 = sum(r.slice(0, na));
    const U1 = R1 - (na * (na + 1)) / 2, U2 = na * nb - U1;
    const N = na + nb;
    const mu = (na * nb) / 2;
    const sig = Math.sqrt(((na * nb) / 12) * (N + 1 - tieSum(all) / (N * (N - 1))));
    const z = sig > 0 ? (Math.min(U1, U2) - mu) / sig : NaN;
    return { U: Math.min(U1, U2), z, p: sig > 0 ? pNorm2(z) : NaN, rbc: (U1 - U2) / (na * nb) };
  }

  function anova(groups) {
    const all = [].concat(...groups), N = all.length, k = groups.length, gm = mean(all);
    const ssb = sum(groups.map((g) => g.length * (mean(g) - gm) ** 2));
    const ssw = sum(groups.map((g) => sum(g.map((x) => (x - mean(g)) ** 2))));
    const df1 = k - 1, df2 = N - k;
    const F = ssb / df1 / (ssw / df2);
    return { F, df1, df2, p: pF(F, df1, df2), eta2: ssb / (ssb + ssw) };
  }

  function kruskal(groups) {
    const all = [].concat(...groups), N = all.length, r = ranks(all);
    let pos = 0, H = 0;
    groups.forEach((g) => {
      const rs = sum(r.slice(pos, pos + g.length));
      H += (rs * rs) / g.length;
      pos += g.length;
    });
    H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
    H /= 1 - tieSum(all) / (N * N * N - N);
    return { H, df: groups.length - 1, p: pChi2(H, groups.length - 1) };
  }

  /* ---------- Pipeline completo ---------- */
  /*
   * input: {
   *   rows: [[...], ...]            // sin encabezado
   *   scale: {min, max}
   *   items: [{col, name, dim, reverse}]
   *   groups: [{col, name}]
   *   minGroupN: 5
   * }
   */
  function analyze(input) {
    const { rows, scale, items, groups = [] } = input;
    const minGroupN = input.minGroupN || 5;
    const n = rows.length;
    const dims = [];
    items.forEach((it) => {
      let d = dims.find((x) => x.name === it.dim);
      if (!d) dims.push((d = { name: it.dim, items: [] }));
      d.items.push(it);
    });

    // Matriz de ítems limpia (NaN si falta o está fuera de rango)
    const flags = { outOfRange: {}, missing: {} };
    const val = (r, it) => {
      let v = rows[r][it.col];
      if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v.replace(',', '.')))) v = Number(v.replace(',', '.'));
      if (!isNum(v)) { flags.missing[it.name] = (flags.missing[it.name] || 0) + 1; return NaN; }
      if (v < scale.min || v > scale.max) { flags.outOfRange[it.name] = (flags.outOfRange[it.name] || 0) + 1; return NaN; }
      return it.reverse ? scale.min + scale.max - v : v;
    };
    const M = rows.map((_, r) => items.map((it) => val(r, it)));
    const colOf = new Map(items.map((it, i) => [it, i]));

    // Integridad
    const casesWithMissing = M.filter((r) => r.some((v) => isNaN(v))).length;
    let straight = 0;
    M.forEach((r) => {
      if (r.length >= 5 && r.every((v) => !isNaN(v)) && r.every((v) => v === r[0])) straight++;
    });
    const seen = new Set();
    let duplicates = 0;
    rows.forEach((r, i) => {
      const key = JSON.stringify(items.map((it) => r[it.col]).concat(groups.map((g) => r[g.col])));
      if (seen.has(key)) duplicates++;
      else seen.add(key);
    });

    // Descriptivos por ítem
    const itemStats = items.map((it, i) => {
      const v = M.map((r) => r[i]).filter((x) => !isNaN(x));
      return { name: it.name, dim: it.dim, reverse: !!it.reverse, n: v.length, mean: mean(v), sd: sd(v) };
    });

    // Puntajes por dimensión (media de ítems, exige ≥80 % de ítems respondidos)
    const scores = {};
    dims.forEach((d) => {
      const idx = d.items.map((it) => colOf.get(it));
      scores[d.name] = M.map((r) => {
        const v = idx.map((i) => r[i]).filter((x) => !isNaN(x));
        return v.length >= Math.ceil(0.8 * idx.length) ? mean(v) : NaN;
      });
    });

    const dimStats = dims.map((d) => {
      const idx = d.items.map((it) => colOf.get(it));
      const complete = M.filter((r) => idx.every((i) => !isNaN(r[i]))).map((r) => idx.map((i) => r[i]));
      const cb = cronbach(complete);
      const s = scores[d.name].filter((x) => !isNaN(x));
      return {
        name: d.name, k: d.items.length, n: s.length, mean: mean(s), sd: sd(s),
        alpha: cb.alpha, alphaN: cb.n,
        alphaIfDeleted: d.items.map((it, j) => ({ name: it.name, alpha: cb.ifDeleted[j] })),
      };
    });

    // Fiabilidad global (todos los ítems)
    const allIdx = items.map((_, i) => i);
    const completeAll = M.filter((r) => r.every((v) => !isNaN(v)));
    const globalAlpha = items.length >= 2 ? cronbach(completeAll.map((r) => allIdx.map((i) => r[i]))) : null;

    // Correlaciones Spearman entre dimensiones
    const correlations = [];
    for (let a = 0; a < dims.length; a++) {
      for (let b = a + 1; b < dims.length; b++) {
        const x = [], y = [];
        for (let i = 0; i < n; i++) {
          const u = scores[dims[a].name][i], w = scores[dims[b].name][i];
          if (!isNaN(u) && !isNaN(w)) { x.push(u); y.push(w); }
        }
        correlations.push({ a: dims[a].name, b: dims[b].name, ...spearman(x, y) });
      }
    }

    // Comparaciones entre grupos
    const comparisons = [];
    const skippedGroups = [];
    groups.forEach((g) => {
      const labels = [...new Set(rows.map((r) => r[g.col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== ''))].map(String);
      const ok = labels.filter((l) => rows.filter((r) => String(r[g.col]) === l).length >= minGroupN);
      if (ok.length < 2) { skippedGroups.push({ name: g.name, reason: 'groups<2' }); return; }
      dims.forEach((d) => {
        const gv = ok.map((l) => {
          const v = [];
          rows.forEach((r, i) => { if (String(r[g.col]) === l && !isNaN(scores[d.name][i])) v.push(scores[d.name][i]); });
          return v;
        });
        if (gv.some((v) => v.length < 2)) return;
        const desc = ok.map((l, i) => ({ label: l, n: gv[i].length, mean: mean(gv[i]), sd: sd(gv[i]) }));
        if (ok.length === 2) {
          comparisons.push({ variable: g.name, dim: d.name, groups: desc, kind: 2, welch: welch(gv[0], gv[1]), mw: mannWhitney(gv[0], gv[1]) });
        } else {
          comparisons.push({ variable: g.name, dim: d.name, groups: desc, kind: 'k', anova: anova(gv), kw: kruskal(gv) });
        }
      });
    });

    return {
      n, scale,
      integrity: {
        casesWithMissing, straightLiners: straight, duplicates,
        outOfRange: flags.outOfRange, missing: flags.missing,
      },
      itemStats, dimStats, globalAlpha: globalAlpha && { alpha: globalAlpha.alpha, n: globalAlpha.n, k: globalAlpha.k },
      correlations, comparisons, skippedGroups,
    };
  }

  /* ---------- Formato (Markdown) ---------- */
  const L = {
    es: {
      integrity: 'Verificación de integridad de los datos', metric: 'Indicador', value: 'Valor',
      cases: 'Casos analizados', missingCases: 'Casos con al menos un ítem faltante o fuera de rango',
      straight: 'Respuestas en línea recta (todos los ítems iguales)', dup: 'Filas duplicadas',
      oor: 'Ítems con valores fuera de la escala', none: 'ninguno',
      reliability: 'Fiabilidad y descriptivos por dimensión', dim: 'Dimensión', items: 'Ítems', n: 'n', m: 'M', sd: 'DE',
      alpha: 'α de Cronbach', interp: 'Interpretación', global: 'Todos los ítems',
      itemDesc: 'Descriptivos por ítem', item: 'Ítem', rev: 'inv.',
      corr: 'Correlaciones de Spearman entre dimensiones', pair: 'Par de dimensiones', rho: 'ρ', p: 'p', strength: 'Magnitud',
      comp: 'Comparaciones entre grupos', variable: 'Variable', groupsC: 'Grupos: M (DE), n', test: 'Prueba', stat: 'Estadístico', effect: 'Tamaño del efecto',
      note: 'Las puntuaciones de dimensión son la media de sus ítems (se exige al menos 80 % de ítems respondidos). Los ítems inversos se recodificaron.',
      q: ['inaceptable', 'pobre', 'cuestionable', 'aceptable', 'buena', 'excelente'],
      s: ['muy débil', 'débil', 'moderada', 'fuerte', 'muy fuerte'],
      skipped: 'Variables de agrupación omitidas (menos de dos grupos con n ≥ 5)',
    },
    en: {
      integrity: 'Data integrity check', metric: 'Indicator', value: 'Value',
      cases: 'Cases analysed', missingCases: 'Cases with at least one missing or out-of-range item',
      straight: 'Straight-lining responses (all items identical)', dup: 'Duplicate rows',
      oor: 'Items with out-of-scale values', none: 'none',
      reliability: 'Reliability and descriptives by dimension', dim: 'Dimension', items: 'Items', n: 'n', m: 'M', sd: 'SD',
      alpha: "Cronbach's α", interp: 'Interpretation', global: 'All items',
      itemDesc: 'Item descriptives', item: 'Item', rev: 'rev.',
      corr: 'Spearman correlations between dimensions', pair: 'Dimension pair', rho: 'ρ', p: 'p', strength: 'Magnitude',
      comp: 'Group comparisons', variable: 'Variable', groupsC: 'Groups: M (SD), n', test: 'Test', stat: 'Statistic', effect: 'Effect size',
      note: 'Dimension scores are the mean of their items (at least 80% of items answered). Reverse-coded items were recoded.',
      q: ['unacceptable', 'poor', 'questionable', 'acceptable', 'good', 'excellent'],
      s: ['very weak', 'weak', 'moderate', 'strong', 'very strong'],
      skipped: 'Grouping variables skipped (fewer than two groups with n ≥ 5)',
    },
  };

  const f = (x, d = 2) => (isNum(x) ? x.toFixed(d) : '–');
  const fp = (p) => (!isNum(p) ? '–' : p < 0.001 ? '< .001' : '= ' + p.toFixed(3).replace(/^0/, ''));
  const fr = (x) => (isNum(x) ? x.toFixed(2).replace(/^(-?)0\./, '$1.') : '–');
  const alphaLabel = (a, t) => (!isNum(a) ? '–' : a < 0.5 ? t.q[0] : a < 0.6 ? t.q[1] : a < 0.7 ? t.q[2] : a < 0.8 ? t.q[3] : a < 0.9 ? t.q[4] : t.q[5]);
  const rhoLabel = (r, t) => { const a = Math.abs(r); return !isNum(r) ? '–' : a < 0.2 ? t.s[0] : a < 0.4 ? t.s[1] : a < 0.6 ? t.s[2] : a < 0.8 ? t.s[3] : t.s[4]; };
  const cell = (s) => String(s).replace(/\|/g, '/').replace(/\n/g, ' ');
  const table = (head, body) => '| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|\n' + body.map((r) => '| ' + r.map(cell).join(' | ') + ' |').join('\n') + '\n';

  function toMarkdown(res, lang) {
    const t = L[lang] || L.es;
    let md = '';
    const oor = Object.entries(res.integrity.outOfRange).map(([k, v]) => k + ' (' + v + ')').join(', ') || t.none;
    md += '## ' + t.integrity + '\n\n' + table([t.metric, t.value], [
      [t.cases, res.n], [t.missingCases, res.integrity.casesWithMissing], [t.straight, res.integrity.straightLiners],
      [t.dup, res.integrity.duplicates], [t.oor, oor],
    ]) + '\n';

    const rel = res.dimStats.map((d) => [d.name, d.k, d.n, f(d.mean), f(d.sd), fr(d.alpha), alphaLabel(d.alpha, t)]);
    if (res.globalAlpha) rel.push([t.global, res.globalAlpha.k, res.globalAlpha.n, '–', '–', fr(res.globalAlpha.alpha), alphaLabel(res.globalAlpha.alpha, t)]);
    md += '## ' + t.reliability + '\n\n' + table([t.dim, t.items, t.n, t.m, t.sd, t.alpha, t.interp], rel) + '\n*' + t.note + '*\n\n';

    md += '## ' + t.itemDesc + '\n\n' + table([t.item, t.dim, t.n, t.m, t.sd], res.itemStats.map((s) => [s.name + (s.reverse ? ' (' + t.rev + ')' : ''), s.dim, s.n, f(s.mean), f(s.sd)])) + '\n';

    if (res.correlations.length) {
      md += '## ' + t.corr + '\n\n' + table([t.pair, t.rho, t.p, t.n, t.strength], res.correlations.map((c) => [c.a + ' – ' + c.b, fr(c.rho), fp(c.p), c.n, rhoLabel(c.rho, t)])) + '\n';
    }

    if (res.comparisons.length) {
      const rows = res.comparisons.map((c) => {
        const g = c.groups.map((x) => x.label + ': ' + f(x.mean) + ' (' + f(x.sd) + '), ' + x.n).join('; ');
        if (c.kind === 2) {
          return [c.variable, c.dim, g, 'Welch t / Mann-Whitney U',
            't(' + f(c.welch.df, 1) + ') = ' + f(c.welch.t) + ', p ' + fp(c.welch.p) + '; U = ' + f(c.mw.U, 1) + ', z = ' + f(c.mw.z) + ', p ' + fp(c.mw.p),
            'd = ' + f(c.welch.d) + '; r = ' + f(c.mw.rbc)];
        }
        return [c.variable, c.dim, g, 'ANOVA / Kruskal-Wallis',
          'F(' + c.anova.df1 + ', ' + c.anova.df2 + ') = ' + f(c.anova.F) + ', p ' + fp(c.anova.p) + '; H(' + c.kw.df + ') = ' + f(c.kw.H) + ', p ' + fp(c.kw.p),
          'η² = ' + f(c.anova.eta2, 3)];
      });
      md += '## ' + t.comp + '\n\n' + table([t.variable, t.dim, t.groupsC, t.test, t.stat, t.effect], rows) + '\n';
    }
    if (res.skippedGroups.length) md += '*' + t.skipped + ': ' + res.skippedGroups.map((s) => s.name).join(', ') + '*\n';
    return md;
  }

  return { mean, sd, variance, ranks, pearson, spearman, cronbach, welch, mannWhitney, anova, kruskal, pT2, pF, pChi2, pNorm2, analyze, toMarkdown };
});
