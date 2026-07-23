// ─── Motor de Cálculo de LEDs — Grid (Parte 2) ─────────────────────────────
// Cálculo 100% local no navegador (sem chamadas de servidor/IA).
import { type Point } from "@/lib/nesting/geometry";

export interface LedModel {
  id: string;
  name: string;
  width: number;    // mm
  height: number;   // mm
  power: number;    // W per unit
  spacingX?: number; // mm - gap horizontal entre módulos
  spacingY?: number; // mm - gap vertical entre módulos
  photoUrl?: string;
}

// ─── LED Assignment per part group ────────────────────────────────────────
export type LedAssignment = Record<string, string>;

export const LED_BORDER_MARGIN_MM = 3;

// ─── Point-in-polygon test ─────────────────────────────────────────────────
export function pointInPoly(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Robust shrink polygon (winding-order offset inward along normals) ─────
export function shrinkPolygon(poly: Point[], margin: number): Point[] {
  const n = poly.length;
  if (n < 3) return poly;

  // Determina a ordem de orientação do polígono (Horário ou Anti-horário)
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    sum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  const isCW = sum >= 0;

  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const curr = poly[i];
    const next = poly[(i + 1) % n];

    // Vetores das arestas adjacentes ao vértice atual
    const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
    const e2x = next.x - curr.x, e2y = next.y - curr.y;

    const len1 = Math.hypot(e1x, e1y) || 1;
    const len2 = Math.hypot(e2x, e2y) || 1;

    // Normais apontando para dentro baseadas no sentido de rotação
    const n1x = isCW ? e1y / len1 : -e1y / len1;
    const n1y = isCW ? -e1x / len1 : e1x / len1;

    const n2x = isCW ? e2y / len2 : -e2y / len2;
    const n2y = isCW ? -e2x / len2 : e2x / len2;

    // Vetor bissetriz das duas normais internas
    let bx = n1x + n2x, by = n1y + n2y;
    const blen = Math.hypot(bx, by) || 1;
    bx /= blen; by /= blen;

    // Ajusta o deslocamento em cantos pontiagudos para evitar deformação extrema
    const cosTheta = n1x * n2x + n1y * n2y;
    let scale = 1.0;
    if (cosTheta > -0.99) {
      scale = Math.min(3.0, 1.0 / Math.sqrt((1 + cosTheta) / 2));
    }

    result.push({
      x: curr.x + bx * margin * scale,
      y: curr.y + by * margin * scale,
    });
  }
  return result;
}

// Calcula o pitch com base nas dimensões reais do LED acrescido do espaçamento configurado
export function calcLedPitch(ledModel: LedModel, rot: 0 | 90): { pitchX: number; pitchY: number } {
  const ledW = rot === 90 ? ledModel.height : ledModel.width;
  const ledH = rot === 90 ? ledModel.width : ledModel.height;

  // Espaçamentos definidos no cadastro (caso indefinidos, assume-se folga padrão de 30mm)
  const spX = rot === 90 ? (ledModel.spacingY ?? 30) : (ledModel.spacingX ?? 30);
  const spY = rot === 90 ? (ledModel.spacingX ?? 30) : (ledModel.spacingY ?? 30);

  return {
    pitchX: ledW + spX,
    pitchY: ledH + spY,
  };
}

// ── GRID ENGINE ────────────────────────────────────────────────────────────
export function calcLedsGrid(
  polygon: Point[],
  holes: Point[][],
  ledModel: LedModel,
  _letterHeight: number | null,
  rotation: 0 | 90,
): { totalLeds: number; pitch: number; pitchX: number; pitchY: number; positions: Array<{ x: number; y: number }> } {
  if (polygon.length < 3) return { totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0, positions: [] };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const innerW = maxX - minX;
  const innerH = maxY - minY;
  if (innerW <= 0 || innerH <= 0) return { totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0, positions: [] };

  const ledW = rotation === 90 ? ledModel.height : ledModel.width;
  const ledH = rotation === 90 ? ledModel.width : ledModel.height;

  const { pitchX, pitchY } = calcLedPitch(ledModel, rotation);

  // Margem de recuo interna aplicada nas bordas externas do polígono
  const insetMargin = LED_BORDER_MARGIN_MM;
  const workPoly = shrinkPolygon(polygon, insetMargin);

  let wMinX = Infinity, wMinY = Infinity, wMaxX = -Infinity, wMaxY = -Infinity;
  for (const p of workPoly) {
    if (p.x < wMinX) wMinX = p.x;
    if (p.x > wMaxX) wMaxX = p.x;
    if (p.y < wMinY) wMinY = p.y;
    if (p.y > wMaxY) wMaxY = p.y;
  }
  const workW = wMaxX - wMinX;
  const workH = wMaxY - wMinY;

  if (workW <= 0 || workH <= 0 || workW < ledW || workH < ledH) {
    return { totalLeds: 0, pitch: Math.max(pitchX, pitchY), pitchX, pitchY, positions: [] };
  }

  const positions: Array<{ x: number; y: number }> = [];

  const startY = wMinY + (workH % pitchY) / 2 + pitchY / 2;
  const startX = wMinX + (workW % pitchX) / 2 + pitchX / 2;

  for (let y = startY; y <= wMaxY; y += pitchY) {
    const rowOffset =
      workW < pitchX * 3
        ? 0
        : (
          Math.floor((y - startY) / pitchY) % 2 === 0
            ? 0
            : pitchX / 2
        );

    for (let x = startX + rowOffset; x <= wMaxX; x += pitchX) {
      const pt = { x, y };

      if (!pointInPoly(pt, workPoly)) continue;

      let inHole = false;
      for (const hole of holes) {
        if (pointInPoly(pt, hole)) { inHole = true; break; }
      }
      if (inHole) continue;

      positions.push(pt);
    }
  }

  if (positions.length === 0) {
    let cx = 0, cy = 0;
    for (const p of polygon) { cx += p.x; cy += p.y; }
    cx /= polygon.length; cy /= polygon.length;
    const centroid = { x: cx, y: cy };
    if (pointInPoly(centroid, polygon)) {
      let inHole = false;
      for (const hole of holes) { if (pointInPoly(centroid, hole)) { inHole = true; break; } }
      if (!inHole) positions.push(centroid);
    }
  }

  const pitchBase = Math.max(pitchX, pitchY);
  return { totalLeds: positions.length, pitch: pitchBase, pitchX, pitchY, positions };
}

// ── Dispatcher: escolhe a melhor rotação (0° ou 90°) pela grade local ──────
export function calcLedsForPart(
  polygon: Point[],
  holes: Point[][],
  ledModel: LedModel,
  _borderMargin = 0,
  letterHeight: number | null = null,
  ledRotation: 0 | 90 = 0,
): { totalLeds: number; pitch: number; pitchX: number; pitchY: number; positions: Array<{ x: number; y: number }>; bestRotation: 0 | 90 } {
  if (!polygon.length) return { totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0, positions: [], bestRotation: ledRotation };

  const r0 = calcLedsGrid(polygon, holes, ledModel, letterHeight, 0);
  const r90 = calcLedsGrid(polygon, holes, ledModel, letterHeight, 90);

  const best = r90.totalLeds > r0.totalLeds ? r90 : r0;
  const bestRotation: 0 | 90 = r90.totalLeds > r0.totalLeds ? 90 : 0;
  return { ...best, bestRotation };
}

// Aproximação bbox (usada quando não há polígono real disponível)
export function calcLedsForBbox(
  partWidth: number,
  partHeight: number,
  ledModel: LedModel,
  _borderMargin = 0,
  _letterHeight: number | null = null,
  _ledRotation: 0 | 90 = 0,
): { ledsX: number; ledsY: number; totalLeds: number; pitch: number; pitchX: number; pitchY: number } {
  const W = partWidth;
  const H = partHeight;
  if (W <= 0 || H <= 0) return { ledsX: 0, ledsY: 0, totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0 };

  const usableW = W - LED_BORDER_MARGIN_MM * 2;
  const usableH = H - LED_BORDER_MARGIN_MM * 2;

  const compute = (rot: 0 | 90) => {
    const ledW = rot === 90 ? ledModel.height : ledModel.width;
    const ledH = rot === 90 ? ledModel.width : ledModel.height;
    const { pitchX, pitchY } = calcLedPitch(ledModel, rot);
    if (usableW <= 0 || usableH <= 0 || usableW < ledW || usableH < ledH) {
      return { ledsX: 0, ledsY: 0, totalLeds: 0, pitchX, pitchY };
    }
    const ledsX = Math.max(1, Math.floor(usableW / pitchX));
    const ledsY = Math.max(1, Math.floor(usableH / pitchY));
    return { ledsX, ledsY, totalLeds: ledsX * ledsY, pitchX, pitchY };
  };

  const r0 = compute(0);
  const r90 = compute(90);
  const best = r90.totalLeds > r0.totalLeds ? r90 : r0;
  const pitch = Math.max(best.pitchX, best.pitchY);
  return { ledsX: best.ledsX, ledsY: best.ledsY, totalLeds: best.totalLeds, pitch, pitchX: best.pitchX, pitchY: best.pitchY };
}
