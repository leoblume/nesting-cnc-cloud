// ─── Motor de Cálculo de LEDs — Grid + Perímetro híbrido (Parte 2) ─────────
// Cálculo 100% local no navegador (sem chamadas de servidor/IA).
import { type Point } from "@/lib/nesting/geometry";

export interface LedModel {
  id: string;
  name: string;
  width: number;    // mm
  height: number;   // mm
  power: number;    // W per unit
  photoUrl?: string;
}

// ─── LED Assignment per part group ────────────────────────────────────────
export type LedAssignment = Record<string, string>;

// Modo de cálculo, selecionado na página de cálculo (padrão: retroiluminada)
export type LedMode = "retroiluminada" | "backlight";

// Margem de recuo da borda da letra — faixa 5mm → 3mm.
// Começamos tentando 5mm (mais seguro/estético); se a peça for pequena/fina
// demais para caber algum LED com essa margem, vamos reduzindo até 3mm.
export const LED_BORDER_MARGIN_MAX_MM = 5;
export const LED_BORDER_MARGIN_MIN_MM = 3;
// Mantido para compatibilidade com quem importar a constante antiga.
export const LED_BORDER_MARGIN_MM = LED_BORDER_MARGIN_MIN_MM;

// Um LED com posição e ângulo de rotação (rad) — usado nos modos de
// perímetro/linha-central, onde o módulo acompanha a direção do contorno.
export interface LedPlacement {
  x: number;
  y: number;
  angle: number; // 0 no modo grade (backlight)
}

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

function polygonArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function polygonPerimeter(poly: Point[]): number {
  let p = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

function polygonBounds(poly: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// ─── Offset de polígono (buffer) por normal-por-aresta + interseção de arestas
// adjacentes (miter), com fallback em bisel para cantos degenerados/agudos.
// d > 0 expande para fora, d < 0 encolhe para dentro — funciona independente
// do sentido de enrolamento (CW/CCW) do polígono de entrada.
export function offsetPolygon(poly: Point[], d: number): Point[] {
  const n = poly.length;
  if (d === 0 || n < 3) return poly;

  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    signedArea += p.x * q.y - q.x * p.y;
  }
  const sign = signedArea >= 0 ? 1 : -1;

  const edgeNormals: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = dy / len, ny = -dx / len;
    if (sign < 0) { nx = -nx; ny = -ny; }
    edgeNormals.push({ x: nx, y: ny });
  }

  const miterLimit = Math.max(4, Math.abs(d) * 4);
  const result: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const v = poly[i];
    const nPrev = edgeNormals[prevIdx];
    const nCur = edgeNormals[i];

    const prevA = poly[prevIdx];
    const p1 = { x: prevA.x + nPrev.x * d, y: prevA.y + nPrev.y * d };
    const p2 = { x: v.x + nPrev.x * d, y: v.y + nPrev.y * d };
    const p3 = { x: v.x + nCur.x * d, y: v.y + nCur.y * d };
    const nextB = poly[(i + 1) % n];
    const p4 = { x: nextB.x + nCur.x * d, y: nextB.y + nCur.y * d };

    const miter = lineLineIntersect(p1, p2, p3, p4);
    if (miter && Math.hypot(miter.x - v.x, miter.y - v.y) <= miterLimit) {
      result.push(miter);
    } else {
      result.push(p2, p3);
    }
  }
  return result;
}

function lineLineIntersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + d1x * t, y: p1.y + d1y * t };
}

// Encolhe o polígono para dentro por `margin` mm (atalho para offsetPolygon(poly, -margin))
export function shrinkPolygon(poly: Point[], margin: number): Point[] {
  return offsetPolygon(poly, -margin);
}

// ─── Pitch: a "distância" pedida (dimensão do módulo -15%) é o ESPAÇO VAZIO
// entre um módulo e o próximo — não o pitch (centro a centro) direto. Usar
// esse valor como pitch fazia os módulos ficarem menores que o próprio
// tamanho do LED, sobrepondo-os (sem espaço nenhum). Corrigido: o pitch real
// = tamanho do módulo + espaço (dimensão -15%).
// `density` é um multiplicador ajustável pelo usuário (barra de densidade):
// density > 1 encolhe o espaço (mais LEDs), density < 1 aumenta o espaço
// (menos LEDs). density = 1 é o espaço padrão (dimensão -15%).
export const LED_DENSITY_MIN = 0.4;
export const LED_DENSITY_MAX = 2.5;
export const LED_DENSITY_DEFAULT = 1;

const GAP_BASE_FACTOR = 0.85; // espaço entre módulos = dimensão do módulo -15%

export function calcLedPitch(ledModel: LedModel, rot: 0 | 90, density = LED_DENSITY_DEFAULT): { pitchX: number; pitchY: number } {
  const ledW = rot === 90 ? ledModel.height : ledModel.width;
  const ledH = rot === 90 ? ledModel.width : ledModel.height;
  const d = density > 0 ? density : LED_DENSITY_DEFAULT;

  const gapX = (ledW * GAP_BASE_FACTOR) / d;
  const gapY = (ledH * GAP_BASE_FACTOR) / d;

  return {
    pitchX: ledW + gapX, // tamanho do módulo + espaço vazio até o próximo
    pitchY: ledH + gapY,
  };
}

// Tenta encolher o polígono com margem 5mm→3mm até sobrar área útil para pelo
// menos um módulo LED. Retorna o polígono de trabalho e a margem realmente usada.
function shrinkWithFallback(
  poly: Point[],
  ledW: number,
  ledH: number,
): { work: Point[]; margin: number } {
  for (let margin = LED_BORDER_MARGIN_MAX_MM; margin >= LED_BORDER_MARGIN_MIN_MM - 1e-6; margin -= 0.5) {
    const work = offsetPolygon(poly, -margin);
    const area = polygonArea(work);
    const b = polygonBounds(work);
    if (area > 0 && b.w >= ledW * 0.9 && b.h >= ledH * 0.9) {
      return { work, margin };
    }
  }
  return { work: offsetPolygon(poly, -LED_BORDER_MARGIN_MIN_MM), margin: LED_BORDER_MARGIN_MIN_MM };
}

// ─── Distribui pontos ao longo de um caminho fechado usando um espaçamento
// ANISOTRÓPICO: cada trecho do contorno usa pitchX quando anda mais na
// horizontal e pitchY quando anda mais na vertical (interpolado pelo ângulo
// local). Isso corrige trechos verticais (ex.: a haste vertical do "L") que
// antes usavam sempre o pitch da largura — agora a distância na altura
// (pitchY) também é levada em conta.
function distributeAlongClosedPathAniso(path: Point[], pitchX: number, pitchY: number): LedPlacement[] {
  const n = path.length;
  const minPitch = Math.max(0.01, Math.min(pitchX, pitchY));
  if (n < 2 || (pitchX <= 0 && pitchY <= 0)) return [];

  const segLens: number[] = [];
  const segUnitLens: number[] = []; // "comprimento" do segmento em unidades de pitch local
  const angles: number[] = [];
  let totalUnits = 0;

  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    // Pitch local: mistura pitchX/pitchY conforme a direção do trecho —
    // trecho horizontal pesa mais pitchX, trecho vertical pesa mais pitchY.
    const localPitch = Math.abs(Math.cos(angle)) * pitchX + Math.abs(Math.sin(angle)) * pitchY || minPitch;
    const unitLen = len / localPitch;

    segLens.push(len);
    angles.push(angle);
    segUnitLens.push(unitLen);
    totalUnits += unitLen;
  }
  if (totalUnits <= 0) return [];

  const count = Math.max(1, Math.round(totalUnits));
  const step = totalUnits / count;

  const placements: LedPlacement[] = [];
  let segIdx = 0;
  let segStart = 0; // unidades acumuladas até o início do segmento atual
  let target = step / 2;

  while (placements.length < count && segIdx < n) {
    const uLen = segUnitLens[segIdx] || 1e-9;
    if (target <= segStart + uLen || segIdx === n - 1) {
      const a = path[segIdx], b = path[(segIdx + 1) % n];
      const t = Math.max(0, Math.min(1, (target - segStart) / uLen));
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      placements.push({ x, y, angle: angles[segIdx] });
      target += step;
    } else {
      segStart += uLen;
      segIdx++;
    }
  }
  return placements;
}

// ─── Detecta se o par (contorno externo + furo) forma um "canal" fino —
// uma faixa de largura ~constante (típico de letra caixa vazada / retroiluminada
// pelo canal), caso em que os LEDs devem seguir uma linha central única.
// Aproximação: largura média da faixa ≈ área do anel / perímetro médio.
function detectChannelBand(
  outer: Point[],
  holes: Point[][],
): { isChannel: boolean; bandWidth: number } {
  if (!holes.length) return { isChannel: false, bandWidth: 0 };

  const outerArea = polygonArea(outer);
  const holesArea = holes.reduce((s, h) => s + polygonArea(h), 0);
  const ringArea = outerArea - holesArea;
  if (ringArea <= 0) return { isChannel: false, bandWidth: 0 };

  const outerPerim = polygonPerimeter(outer);
  const holesPerim = holes.reduce((s, h) => s + polygonPerimeter(h), 0);
  const avgPerim = (outerPerim + holesPerim) / (holes.length + 1);
  if (avgPerim <= 0) return { isChannel: false, bandWidth: 0 };

  const bandWidth = ringArea / avgPerim;

  // Se o "anel" ocupa a maior parte da área da letra (pouco material sobrando
  // fora da faixa) e a largura estimada é pequena em relação ao tamanho geral
  // da peça, tratamos como canal fino (linha central).
  const b = polygonBounds(outer);
  const shapeSize = Math.min(b.w, b.h);
  const ringFraction = ringArea / outerArea;

  const isChannel = ringFraction > 0.55 && bandWidth < shapeSize * 0.35;
  return { isChannel, bandWidth };
}

// ── ENGINE — modo "backlight" (grade preenchendo a área total da letra) ───
export function calcLedsGrid(
  polygon: Point[],
  holes: Point[][],
  ledModel: LedModel,
  rotation: 0 | 90,
  density = LED_DENSITY_DEFAULT,
): { totalLeds: number; pitch: number; pitchX: number; pitchY: number; positions: LedPlacement[] } {
  if (polygon.length < 3) return { totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0, positions: [] };

  const ledW = rotation === 90 ? ledModel.height : ledModel.width;
  const ledH = rotation === 90 ? ledModel.width : ledModel.height;

  const { pitchX, pitchY } = calcLedPitch(ledModel, rotation, density);

  // Margem de recuo interna aplicada nas bordas externas do polígono (5mm→3mm)
  const { work: workPoly } = shrinkWithFallback(polygon, ledW, ledH);
  const b = polygonBounds(workPoly);

  if (b.w <= 0 || b.h <= 0 || b.w < ledW || b.h < ledH) {
    return { totalLeds: 0, pitch: Math.max(pitchX, pitchY), pitchX, pitchY, positions: [] };
  }

  const positions: LedPlacement[] = [];

  const startY = b.minY + (b.h % pitchY) / 2 + pitchY / 2;
  const startX = b.minX + (b.w % pitchX) / 2 + pitchX / 2;

  for (let y = startY; y <= b.maxY; y += pitchY) {
    const rowOffset =
      b.w < pitchX * 3
        ? 0
        : (
          Math.floor((y - startY) / pitchY) % 2 === 0
            ? 0
            : pitchX / 2
        );

    for (let x = startX + rowOffset; x <= b.maxX; x += pitchX) {
      const pt = { x, y };

      if (!pointInPoly(pt, workPoly)) continue;

      let inHole = false;
      for (const hole of holes) {
        if (pointInPoly(pt, hole)) { inHole = true; break; }
      }
      if (inHole) continue;

      positions.push({ x, y, angle: 0 });
    }
  }

  if (positions.length === 0) {
    let cx = 0, cy = 0;
    for (const p of polygon) { cx += p.x; cy += p.y; }
    cx /= polygon.length; cy /= polygon.length;
    const centroidPt = { x: cx, y: cy };
    if (pointInPoly(centroidPt, polygon)) {
      let inHole = false;
      for (const hole of holes) { if (pointInPoly(centroidPt, hole)) { inHole = true; break; } }
      if (!inHole) positions.push({ ...centroidPt, angle: 0 });
    }
  }

  const pitchBase = Math.max(pitchX, pitchY);
  return { totalLeds: positions.length, pitch: pitchBase, pitchX, pitchY, positions };
}

// ── ENGINE — modo "retroiluminada" (híbrido: linha central OU perímetro) ──
export function calcLedsPerimeter(
  polygon: Point[],
  holes: Point[][],
  ledModel: LedModel,
  rotation: 0 | 90,
  density = LED_DENSITY_DEFAULT,
): { totalLeds: number; pitch: number; pitchX: number; pitchY: number; positions: LedPlacement[]; usedCenterline: boolean } {
  if (polygon.length < 3) return { totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0, positions: [], usedCenterline: false };

  const ledW = rotation === 90 ? ledModel.height : ledModel.width;
  const ledH = rotation === 90 ? ledModel.width : ledModel.height;
  const { pitchX, pitchY } = calcLedPitch(ledModel, rotation, density);

  const { isChannel, bandWidth } = detectChannelBand(polygon, holes);

  let path: Point[];
  let usedCenterline = false;

  if (isChannel && bandWidth > 0) {
    // Letra em forma de canal fino (ex.: letra caixa vazada) — os LEDs
    // seguem uma linha central única, no meio da faixa.
    const half = Math.max(0.5, bandWidth / 2);
    path = offsetPolygon(polygon, -half);
    usedCenterline = true;
  } else {
    // Letra espessa/sólida — os LEDs seguem o perímetro externo da letra,
    // recuados da borda pela margem 5mm→3mm.
    const { work } = shrinkWithFallback(polygon, ledW, ledH);
    path = work;
    usedCenterline = false;
  }

  if (path.length < 3) return { totalLeds: 0, pitch: pitchX, pitchX, pitchY, positions: [], usedCenterline };

  // Espaçamento anisotrópico: trechos horizontais do contorno usam pitchX,
  // trechos verticais usam pitchY (interpolado pelo ângulo local) — assim a
  // distância na altura (ex.: haste vertical do "L") também é calculada.
  const positions = distributeAlongClosedPathAniso(path, pitchX, pitchY);

  return {
    totalLeds: positions.length,
    pitch: Math.max(pitchX, pitchY),
    pitchX,
    pitchY,
    positions,
    usedCenterline,
  };
}

// ── Dispatcher: escolhe a melhor rotação (0° ou 90°) e o modo de cálculo ──
export function calcLedsForPart(
  polygon: Point[],
  holes: Point[][],
  ledModel: LedModel,
  mode: LedMode = "retroiluminada",
  density = LED_DENSITY_DEFAULT,
): { totalLeds: number; pitch: number; pitchX: number; pitchY: number; positions: LedPlacement[]; bestRotation: 0 | 90; usedCenterline: boolean } {
  if (!polygon.length) return { totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0, positions: [], bestRotation: 0, usedCenterline: false };

  if (mode === "backlight") {
    const r0 = calcLedsGrid(polygon, holes, ledModel, 0, density);
    const r90 = calcLedsGrid(polygon, holes, ledModel, 90, density);
    const best = r90.totalLeds > r0.totalLeds ? r90 : r0;
    const bestRotation: 0 | 90 = r90.totalLeds > r0.totalLeds ? 90 : 0;
    return { ...best, bestRotation, usedCenterline: false };
  }

  // Retroiluminada: perímetro/linha-central não depende de rotação do módulo
  // no plano (o módulo já acompanha o ângulo do contorno) — calculamos direto.
  const r = calcLedsPerimeter(polygon, holes, ledModel, 0, density);
  return { ...r, bestRotation: 0 };
}

// Aproximação bbox (usada quando não há polígono real disponível)
export function calcLedsForBbox(
  partWidth: number,
  partHeight: number,
  ledModel: LedModel,
  mode: LedMode = "retroiluminada",
  density = LED_DENSITY_DEFAULT,
): { ledsX: number; ledsY: number; totalLeds: number; pitch: number; pitchX: number; pitchY: number } {
  const W = partWidth;
  const H = partHeight;
  if (W <= 0 || H <= 0) return { ledsX: 0, ledsY: 0, totalLeds: 0, pitch: 0, pitchX: 0, pitchY: 0 };

  if (mode === "retroiluminada") {
    // Sem geometria real: aproxima como um retângulo — LEDs ao longo do
    // perímetro recuado pela margem 5mm→3mm.
    const rect: Point[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    const { pitchX, pitchY } = calcLedPitch(ledModel, 0, density);
    const { work } = shrinkWithFallback(rect, ledModel.width, ledModel.height);
    const positions = distributeAlongClosedPathAniso(work, pitchX, pitchY);
    return { ledsX: 0, ledsY: 0, totalLeds: positions.length, pitch: Math.max(pitchX, pitchY), pitchX, pitchY };
  }

  const usableW = W - LED_BORDER_MARGIN_MIN_MM * 2;
  const usableH = H - LED_BORDER_MARGIN_MIN_MM * 2;

  const compute = (rot: 0 | 90) => {
    const ledW = rot === 90 ? ledModel.height : ledModel.width;
    const ledH = rot === 90 ? ledModel.width : ledModel.height;
    const { pitchX, pitchY } = calcLedPitch(ledModel, rot, density);
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
