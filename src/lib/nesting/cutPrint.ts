// ─── Impressão do Plano de Corte (Parte 1 — Nesting) ───────────────────────
import type { NestResult, NestingOptions } from "./nesting";
import type { OverlapPair } from "./overlapCheck";
import { renderSheet } from "./render";

export function printCutPlan(
  result: NestResult,
  opts: NestingOptions,
  fileName: string,
  overlaps: OverlapPair[] = [],
) {
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) { alert("Permita popups para imprimir."); return; }

  const SHEET_PX_W = 760;
  const SHEET_PX_H = Math.round(SHEET_PX_W * (opts.sheetHeight / opts.sheetWidth));

  const sheetDataUrls: string[] = [];
  for (let si = 0; si < result.sheets.length; si++) {
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_PX_W;
    canvas.height = SHEET_PX_H;
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `width:${SHEET_PX_W}px;height:${SHEET_PX_H}px;position:absolute;left:-9999px`;
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    renderSheet(canvas, result.sheets[si], opts.sheetWidth, opts.sheetHeight, opts.margin);
    sheetDataUrls.push(canvas.toDataURL("image/png"));
    document.body.removeChild(wrapper);
  }

  const now = new Date().toLocaleString("pt-BR");
  const totalParts = result.sheets.reduce((s, sh) => s + sh.length, 0);

  const css = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 10px; }
body {
  font-family: 'Courier New', Courier, monospace;
  color: #111;
  background: #fff;
  padding: 10mm;
  max-width: 210mm;
  margin: 0 auto;
}
.doc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 2.5px solid #1e293b;
  padding-bottom: 5px;
  margin-bottom: 8px;
  gap: 12px;
}
.doc-title { font-size: 13px; font-weight: 700; letter-spacing: -.3px; }
.doc-sub   { font-size: 8px; color: #555; margin-top: 2px; line-height: 1.6; }
.doc-meta  { text-align: right; font-size: 8px; color: #555; line-height: 1.6; white-space: nowrap; }
.sec { margin-bottom: 10px; }
.sec-title {
  font-size: 8px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 1px;
  color: #fff; background: #1e293b;
  padding: 2px 7px; margin-bottom: 6px;
  display: block;
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin-bottom: 8px;
}
.kpi { border: 1px solid #d1d5db; padding: 4px 6px; }
.kpi-label { font-size: 7px; text-transform: uppercase; letter-spacing: .4px; color: #6b7280; }
.kpi-val   { font-size: 15px; font-weight: 700; line-height: 1.1; }
.green { color: #15803d; } .blue { color: #1d4ed8; } .amber { color: #b45309; }
.sheet-block { margin-bottom: 8px; page-break-inside: avoid; }
.sheet-label { font-size: 8px; font-weight: 700; color: #334155; margin-bottom: 3px; }
.sheet-img { width: 100%; border: 1px solid #cbd5e1; display: block; }
.warn { border: 1.5px solid #dc2626; background: #fef2f2; color: #991b1b; padding: 6px 8px; font-size: 8.5px; font-weight: 700; margin-bottom: 8px; }
@media print {
  body { padding: 7mm; }
  .no-print { display: none !important; }
  @page { size: A4 portrait; margin: 7mm; }
  .page-break { page-break-before: always; break-before: page; }
  .sheet-block { break-inside: avoid; }
}
.no-print {
  position: fixed; top: 10px; right: 10px; z-index: 9999;
  display: flex; gap: 8px;
}
.btn {
  border: none; padding: 8px 16px; font-size: 11px;
  cursor: pointer; font-family: monospace; font-weight: 700;
  border-radius: 3px;
}
.btn-print { background: #1e293b; color: #fff; }
.btn-print:hover { background: #0f172a; }
.btn-close { background: #64748b; color: #fff; }
`;

  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plano de Corte — ${fileName}</title>
<style>${css}</style>
</head>
<body>

<div class="doc-header">
  <div>
    <div class="doc-title">📐 Plano de Corte</div>
    <div class="doc-sub">
      Arquivo: <b>${fileName}</b> &nbsp;·&nbsp;
      Chapa: <b>${opts.sheetWidth} × ${opts.sheetHeight} mm</b> &nbsp;·&nbsp;
      Folga: ${opts.gap} mm &nbsp;·&nbsp; Margem: ${opts.margin} mm
    </div>
  </div>
  <div class="doc-meta">
    Gerado: ${now}<br>
    NestCNC
  </div>
</div>

${overlaps.length > 0 ? `<div class="warn">⚠ ATENÇÃO: ${overlaps.length} sobreposição(ões) de peça detectada(s). Confira o resultado antes de cortar.</div>` : ""}

<div class="summary">
  <div class="kpi"><div class="kpi-label">Chapas usadas</div><div class="kpi-val blue">${result.sheets.length}</div></div>
  <div class="kpi"><div class="kpi-label">Peças total</div><div class="kpi-val">${totalParts}</div></div>
  <div class="kpi"><div class="kpi-label">Não posicionadas</div><div class="kpi-val ${result.unplaced.length ? "amber" : ""}">${result.unplaced.length}</div></div>
  <div class="kpi"><div class="kpi-label">Aproveitamento</div><div class="kpi-val green">${(result.utilization * 100).toFixed(1)}%</div></div>
</div>`;

  html += `<div class="sec"><span class="sec-title">Chapas de Corte</span>`;
  for (let si = 0; si < result.sheets.length; si++) {
    const sh = result.sheets[si];
    if (si > 0) html += `<div class="page-break"></div>`;
    html += `<div class="sheet-block">
  <div class="sheet-label">Chapa ${si + 1} / ${result.sheets.length} — ${sh.length} peça(s) posicionada(s)</div>
  <img class="sheet-img" src="${sheetDataUrls[si]}" />
</div>`;
  }
  html += `</div>`;

  html += `
<div class="no-print">
  <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir A4</button>
  <button class="btn btn-close" onclick="window.close()">✕ Fechar</button>
</div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); }, 300);
}
