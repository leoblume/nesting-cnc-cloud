// ─── Impressão do Plano de LEDs (Parte 2 — LEDs) ───────────────────────────
// Impressão simplificada: mostra apenas o desenho de posicionamento, o tipo
// de LED calculado e a quantidade de peças — sem dados técnicos extras
// (dimensão da peça, pitch, LEDs/peça, total de LEDs, potência).
import { groupParts } from "@/lib/nesting/parser";
import { calcLedsForPart, calcLedsForBbox, type LedModel, type LedAssignment } from "./ledEngine";

export function printLedPlan(
  groups: ReturnType<typeof groupParts>,
  ledModels: LedModel[],
  selectedLedId: string | null,
  ledAssignments: LedAssignment,
  letterHeight: number | null,
  fileName: string,
) {
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) { alert("Permita popups para imprimir."); return; }

  const resolveLed = (groupKey: string): LedModel | null => {
    const assignedId = ledAssignments[groupKey] ?? selectedLedId;
    return ledModels.find((l) => l.id === assignedId) ?? null;
  };

  const DRAW = 260;
  const PAD = 14;
  const CANVAS_W = DRAW + PAD * 2;
  const CANVAS_H = DRAW + PAD * 2;

  interface LedCard {
    dataUrl: string;
    ledName: string;
    quantity: number;
    ledsPerPiece: number;
  }

  const ledCards: LedCard[] = [];

  for (const g of groups) {
    const ledModel = resolveLed(g.key);
    const poly = g.parts[0]?.outer ?? [];
    const holes = g.parts[0]?.holes ?? [];

    let positions: Array<{ x: number; y: number }> = [];
    let bestRotation: 0 | 90 = 0;
    let ledsPerPiece = 0;

    if (ledModel && poly.length) {
      const r = calcLedsForPart(poly, holes, ledModel, 0, letterHeight, 0);
      positions = r.positions; bestRotation = r.bestRotation;
      ledsPerPiece = positions.length;
    }

    const S = Math.min(DRAW / Math.max(g.width, g.height, 1), 6);
    const pw = g.width * S;
    const ph = g.height * S;
    const ox = PAD + (DRAW - pw) / 2;
    const oy = PAD + (DRAW - ph) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (poly.length > 0) {
      let pminX = Infinity, pminY = Infinity;
      for (const p of poly) {
        if (p.x < pminX) pminX = p.x;
        if (p.y < pminY) pminY = p.y;
      }
      const toS = (p: { x: number; y: number }) => ({ x: ox + (p.x - pminX) * S, y: oy + (p.y - pminY) * S });

      ctx.beginPath();
      const sp0 = toS(poly[0]); ctx.moveTo(sp0.x, sp0.y);
      for (let i = 1; i < poly.length; i++) { const sp = toS(poly[i]); ctx.lineTo(sp.x, sp.y); }
      ctx.closePath();
      ctx.fillStyle = "#dbeafe"; ctx.fill();
      ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 1; ctx.stroke();

      for (const hole of holes) {
        if (!hole.length) continue;
        ctx.beginPath();
        const sh0 = toS(hole[0]); ctx.moveTo(sh0.x, sh0.y);
        for (let i = 1; i < hole.length; i++) { ctx.lineTo(toS(hole[i]).x, toS(hole[i]).y); }
        ctx.closePath();
        ctx.fillStyle = "#ffffff"; ctx.fill();
        ctx.strokeStyle = "#93c5fd"; ctx.lineWidth = 1; ctx.stroke();
      }

      if (ledModel && positions.length) {
        const rawW = bestRotation === 90 ? ledModel.height : ledModel.width;
        const rawH = bestRotation === 90 ? ledModel.width : ledModel.height;
        const lw = Math.max(3, rawW * S);
        const lh = Math.max(3, rawH * S);
        for (const pos of positions) {
          const lx = ox + (pos.x - pminX) * S;
          const ly = oy + (pos.y - pminY) * S;
          ctx.fillStyle = "#fbbf24"; ctx.strokeStyle = "#92400e"; ctx.lineWidth = 0.5;
          ctx.fillRect(lx - lw / 2, ly - lh / 2, lw, lh);
          ctx.strokeRect(lx - lw / 2, ly - lh / 2, lw, lh);
        }
      }
    } else {
      ctx.fillStyle = "#dbeafe"; ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 1;
      ctx.fillRect(ox, oy, pw, ph); ctx.strokeRect(ox, oy, pw, ph);
      if (ledModel) {
        const { ledsX, ledsY } = calcLedsForBbox(g.width, g.height, ledModel, 0, letterHeight, 0);
        ledsPerPiece = ledsX * ledsY;
        const lw = Math.max(3, ledModel.width * S);
        const lh = Math.max(3, ledModel.height * S);
        for (let row = 0; row < ledsY; row++) {
          for (let col = 0; col < ledsX; col++) {
            const lx = ox + (col + 0.5) * (pw / Math.max(ledsX, 1));
            const ly = oy + (row + 0.5) * (ph / Math.max(ledsY, 1));
            ctx.fillStyle = "#fbbf24"; ctx.fillRect(lx - lw / 2, ly - lh / 2, lw, lh);
          }
        }
      }
    }

    ledCards.push({
      dataUrl: canvas.toDataURL("image/png"),
      ledName: ledModel?.name ?? "–",
      quantity: g.quantity,
      ledsPerPiece,
    });
  }

  const now = new Date().toLocaleString("pt-BR");

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
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}
.card {
  border: 1.5px solid #cbd5e1;
  page-break-inside: avoid;
  overflow: hidden;
  background: #fff;
}
.card-img  { display: block; width: 100%; border-bottom: 1px solid #e2e8f0; }
.card-body { padding: 5px 6px; background: #f8fafc; }
.card-badge {
  display: inline-block;
  background: #1e293b; color: #fff;
  font-size: 7px; font-weight: 700;
  padding: 1px 5px; border-radius: 2px;
  margin-bottom: 4px;
}
.card-name {
  font-size: 9px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card-led-qty {
  font-size: 8px; font-weight: 700; color: #b45309;
  margin-top: 2px;
}
table { width: 100%; border-collapse: collapse; font-size: 9px; }
thead th {
  background: #1e293b; color: #fff;
  font-size: 8px; font-weight: 700;
  text-align: right; padding: 3px 6px;
  border: 1px solid #334155;
}
thead th:first-child { text-align: left; }
tbody td {
  font-size: 8.5px; padding: 3px 6px;
  border: 1px solid #e5e7eb; text-align: right;
}
tbody td:first-child { text-align: left; }
tbody tr:nth-child(even) td { background: #f9fafb; }
tfoot td {
  font-size: 9px; font-weight: 700; padding: 3px 6px;
  border: 1px solid #cbd5e1; text-align: right;
  background: #f1f5f9; border-top: 2px solid #1e293b;
}
tfoot td:first-child { text-align: left; }
@media print {
  body { padding: 7mm; }
  .no-print { display: none !important; }
  @page { size: A4 portrait; margin: 7mm; }
  .page-break { page-break-before: always; break-before: page; }
  .card { break-inside: avoid; }
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
<title>Plano de LEDs — ${fileName}</title>
<style>${css}</style>
</head>
<body>

<div class="doc-header">
  <div>
    <div class="doc-title">💡 Posicionamento de LEDs</div>
    <div class="doc-sub">Arquivo: <b>${fileName}</b></div>
  </div>
  <div class="doc-meta">
    Gerado: ${now}<br>
    NestCNC
  </div>
</div>`;

  if (ledCards.length > 0) {
    html += `<div class="sec"><span class="sec-title">Posicionamento por Modelo de Peça</span>`;
    html += `<div class="card-grid">`;
    for (let ci = 0; ci < ledCards.length; ci++) {
      const card = ledCards[ci];
      if (ci > 0 && ci % 6 === 0) {
        html += `</div><div class="page-break"></div><div class="card-grid">`;
      }
      const totalLedsCard = card.ledsPerPiece * card.quantity;
      html += `
<div class="card">
  <img class="card-img" src="${card.dataUrl}" alt="Peça ${ci + 1}" />
  <div class="card-body">
    <div class="card-badge">×${card.quantity} peça${card.quantity !== 1 ? "s" : ""}</div>
    <div class="card-name" title="${card.ledName}">${card.ledName}</div>
    <div class="card-led-qty">${card.ledsPerPiece} LED${card.ledsPerPiece !== 1 ? "s" : ""}/peça${card.quantity > 1 ? ` &nbsp;·&nbsp; ${totalLedsCard} total` : ""}</div>
  </div>
</div>`;
    }
    html += `</div></div>`;
  }

  if (ledCards.length > 0) {
    const byModel = new Map<string, number>();
    for (const c of ledCards) byModel.set(c.ledName, (byModel.get(c.ledName) ?? 0) + c.quantity);

    html += `<div class="sec">
<span class="sec-title">Lista de Materiais — LEDs</span>
<table>
<thead><tr><th>Tipo do LED</th><th>Quantidade (peças)</th></tr></thead>
<tbody>`;
    for (const [name, qty] of byModel.entries()) {
      html += `<tr><td>${name}</td><td>${qty}</td></tr>`;
    }
    const totalQty = Array.from(byModel.values()).reduce((s, v) => s + v, 0);
    html += `</tbody>
<tfoot><tr><td>TOTAL</td><td>${totalQty}</td></tr></tfoot>
</table>
</div>`;
  }

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
