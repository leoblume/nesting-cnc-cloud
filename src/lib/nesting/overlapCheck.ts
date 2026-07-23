// ─── Verificação de peças sobrepostas ──────────────────────────────────────
// Passo de validação pós-nesting: confere, chapa a chapa, se algum par de
// peças posicionadas ficou de fato sobreposto (independente da folga usada
// no algoritmo). Serve como rede de segurança contra bugs de geometria.
import { bboxOverlap, polygonsIntersect } from "./geometry";
import type { PlacedPart } from "./nesting";

export interface OverlapPair {
  sheetIndex: number;
  partAId: string;
  partBId: string;
}

export function detectOverlaps(sheets: PlacedPart[][]): OverlapPair[] {
  const overlaps: OverlapPair[] = [];

  sheets.forEach((sheet, sheetIndex) => {
    for (let i = 0; i < sheet.length; i++) {
      for (let j = i + 1; j < sheet.length; j++) {
        const a = sheet[i];
        const b = sheet[j];
        if (!bboxOverlap(a.bbox, b.bbox, 0)) continue;
        if (polygonsIntersect(a.polygon, b.polygon)) {
          overlaps.push({ sheetIndex, partAId: a.partId, partBId: b.partId });
        }
      }
    }
  });

  return overlaps;
}
