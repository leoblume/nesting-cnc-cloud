import { useCallback, useEffect, useRef } from "react";
import { type Point } from "@/lib/nesting/geometry";
import { type groupParts } from "@/lib/nesting/parser";
import { calcLedsForPart, calcLedsForBbox, type LedModel, type LedAssignment } from "@/lib/leds/ledEngine";

export function LedDrawingCanvas({
  groups,
  ledModels,
  selectedLedId,
  ledAssignments,
  letterHeight = null,
  ledRotation = 0,
}: {
  groups: ReturnType<typeof groupParts>;
  ledModels: LedModel[];
  selectedLedId: string | null;
  ledAssignments: LedAssignment;
  letterHeight?: number | null;
  ledRotation?: 0 | 90;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resolveLed = useCallback((groupKey: string): LedModel | null => {
    const assignedId = ledAssignments[groupKey] ?? selectedLedId;
    return ledModels.find((l) => l.id === assignedId) ?? null;
  }, [ledModels, selectedLedId, ledAssignments]);

  useEffect(() => {
    if (!canvasRef.current || groups.length === 0) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;

    const COLS = Math.min(4, groups.length);
    const ROWS = Math.ceil(groups.length / COLS);
    const CELL_PAD = 24;
    const LABEL_TOP = 16;
    const LABEL_BOTTOM = 48;
    const MAX_PART = 150;

    const maxW = Math.max(...groups.map((g) => g.width));
    const maxH = Math.max(...groups.map((g) => g.height));
    const cellW = Math.min(MAX_PART, maxW) + 2 * CELL_PAD;
    const cellH = Math.min(MAX_PART, maxH) + 2 * CELL_PAD + LABEL_TOP + LABEL_BOTTOM;

    const totalW = COLS * cellW;
    const totalH = ROWS * cellH;

    canvas.width = totalW * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = `${totalW}px`;
    canvas.style.height = `${totalH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalW, totalH);

    groups.forEach((g, gi) => {
      const col = gi % COLS;
      const row = Math.floor(gi / COLS);

      const ledModel = resolveLed(g.key);

      const scaleX = Math.min(1, (cellW - 2 * CELL_PAD) / g.width);
      const scaleY = Math.min(1, (cellH - 2 * CELL_PAD - LABEL_TOP - LABEL_BOTTOM) / g.height);
      const s = Math.min(scaleX, scaleY);

      const pw = g.width * s;
      const ph = g.height * s;

      const ox = col * cellW + CELL_PAD + (cellW - 2 * CELL_PAD - pw) / 2;
      const oy = row * cellH + CELL_PAD + LABEL_TOP;

      const poly = g.parts[0]?.outer ?? null;
      const holes = g.parts[0]?.holes ?? [];

      if (poly && poly.length > 0) {
        let pminX = Infinity, pminY = Infinity, pmaxX = -Infinity, pmaxY = -Infinity;
        for (const p of poly) {
          if (p.x < pminX) pminX = p.x; if (p.x > pmaxX) pmaxX = p.x;
          if (p.y < pminY) pminY = p.y; if (p.y > pmaxY) pmaxY = p.y;
        }

        const toScreen = (p: Point) => ({
          x: ox + (p.x - pminX) * s,
          y: oy + (p.y - pminY) * s,
        });

        ctx.beginPath();
        const sp0 = toScreen(poly[0]);
        ctx.moveTo(sp0.x, sp0.y);
        for (let i = 1; i < poly.length; i++) {
          const sp = toScreen(poly[i]);
          ctx.lineTo(sp.x, sp.y);
        }
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#991b1b";
        ctx.lineWidth = 1;
        ctx.stroke();

        for (const hole of holes) {
          if (!hole.length) continue;
          ctx.beginPath();
          const sh0 = toScreen(hole[0]);
          ctx.moveTo(sh0.x, sh0.y);
          for (let i = 1; i < hole.length; i++) {
            const sh = toScreen(hole[i]);
            ctx.lineTo(sh.x, sh.y);
          }
          ctx.closePath();
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#991b1b88";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (ledModel) {
          const ledResult = calcLedsForPart(poly, holes, ledModel, 0, letterHeight, ledRotation);
          const { positions, totalLeds, bestRotation: partRot } = ledResult;

          const rawW = partRot === 90 ? ledModel.height : ledModel.width;
          const rawH = partRot === 90 ? ledModel.width : ledModel.height;
          const ledW = Math.max(2, rawW * s);
          const ledH = Math.max(2, rawH * s);

          for (const pos of positions) {
            const lx = ox + (pos.x - pminX) * s;
            const ly = oy + (pos.y - pminY) * s;
            ctx.fillStyle = "#facc15";
            ctx.strokeStyle = "#a16207";
            ctx.lineWidth = 0.5;
            ctx.fillRect(lx - ledW / 2, ly - ledH / 2, ledW, ledH);
            ctx.strokeRect(lx - ledW / 2, ly - ledH / 2, ledW, ledH);
          }

          ctx.fillStyle = "#475569";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${g.width.toFixed(0)} × ${g.height.toFixed(0)} mm`, ox + pw / 2, oy - 2);

          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(`${totalLeds} LEDs`, ox + pw / 2, oy + ph + 8);

          ctx.fillStyle = "#7c3aed";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(ledModel.name, ox + pw / 2, oy + ph + 20);

          const { totalLeds: bboxTotal } = calcLedsForBbox(g.width, g.height, ledModel, 0, letterHeight, ledRotation);
          const coverage = bboxTotal > 0 ? Math.round((totalLeds / bboxTotal) * 100) : 0;
          ctx.fillStyle = "#15803d";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(`aproveit. ${coverage}%`, ox + pw / 2, oy + ph + 32);
        } else {
          ctx.fillStyle = "#64748b";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${g.width.toFixed(0)} × ${g.height.toFixed(0)} mm`, ox + pw / 2, oy - 2);
          ctx.fillStyle = "#dc2626";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("Sem LED atribuído", ox + pw / 2, oy + ph + 8);
        }

        const badgeW = 24, badgeH = 14;
        ctx.fillStyle = "#1e40af";
        ctx.beginPath();
        ctx.roundRect(ox + pw - badgeW - 2, oy + 2, badgeW, badgeH, 3);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`×${g.quantity}`, ox + pw - badgeW / 2 - 2, oy + 2 + badgeH / 2);

      } else {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#991b1b";
        ctx.lineWidth = 1;
        ctx.fillRect(ox, oy, pw, ph);
        ctx.strokeRect(ox, oy, pw, ph);

        if (ledModel) {
          const { totalLeds } = calcLedsForBbox(g.width, g.height, ledModel, 0, letterHeight, ledRotation);
          ctx.fillStyle = "#64748b";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${g.width.toFixed(0)} × ${g.height.toFixed(0)} mm`, ox + pw / 2, oy - 2);
          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(`${totalLeds} LEDs`, ox + pw / 2, oy + ph + 8);
        }
      }
    });
  }, [groups, ledModels, selectedLedId, ledAssignments, letterHeight, ledRotation, resolveLed]);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-auto rounded-lg border border-border p-2" style={{ background: "#ffffff" }}>
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
