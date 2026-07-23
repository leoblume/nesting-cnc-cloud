// Nesting algorithm: bottom-left fill with rotation and polygon collision
import {
  type Polygon,
  type PartGeometry,
  rotatePolygon,
  translatePolygon,
  bbox,
  bboxOverlap,
  polygonsIntersect,
  inflatePolygon,
  mirrorPolygon,
} from "./geometry";
import type { ParsedPart } from "./parser";

export interface NestingOptions {
  sheetWidth: number;
  sheetHeight: number;
  gap: number;
  margin: number;
  allowRotation: boolean;
  allowMirror: boolean;
  // Rotation angle increment in degrees, used only when allowRotation is true.
  // 90 = fast (default, axis-aligned), smaller values (45/30/15/5/1) try more angles
  // for a tighter fit at the cost of nesting time.
  rotationStep?: number;
}

export interface PlacedPart {
  partId: string;
  groupSig: string;
  sheetIndex: number;
  rotation: number;
  mirrored: boolean;
  x: number;
  y: number;
  polygon: Polygon; // final placed polygon (with margin offset already applied on x/y)
  holes: Polygon[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  area: number;       // real polygon area (for reference)
  bboxArea: number;   // rectangular bounding-box area — what actually gets consumed on the sheet
}

export interface NestResult {
  sheets: PlacedPart[][];
  unplaced: { partId: string; groupSig: string }[];
  totalPartArea: number;      // sum of polygon areas (informational)
  totalBboxArea: number;      // sum of bbox areas (rectangular occupation)
  totalSheetArea: number;     // total area of all sheets used
  utilization: number;        // totalBboxArea / totalSheetArea  — real rectangular utilization
}

function transformGeom(geom: PartGeometry, rotation: number, mirror: boolean) {
  let outer = geom.outer;
  let holes = geom.holes;
  if (mirror) {
    outer = mirrorPolygon(outer);
    holes = holes.map(mirrorPolygon);
  }
  if (rotation) {
    outer = rotatePolygon(outer, rotation);
    holes = holes.map((h) => rotatePolygon(h, rotation));
  }
  const b = bbox(outer);
  const dx = -b.minX, dy = -b.minY;
  outer = translatePolygon(outer, dx, dy);
  holes = holes.map((h) => translatePolygon(h, dx, dy));
  return { outer, holes };
}

// Builds candidate rotation angles [0, step, 2*step, ...) < 360.
// Step is clamped to a sane range so the UI can't accidentally request
// thousands of angle candidates per part (which would make nesting freeze).
function buildRotationAngles(step: number): number[] {
  const s = Math.min(180, Math.max(1, Math.round(step) || 90));
  const angles: number[] = [];
  for (let a = 0; a < 360; a += s) angles.push(a);
  return angles;
}

// Yields control back to the browser so it can paint (progress bar, etc). Throttled so we
// don't pay the ~4ms setTimeout/rAF tax on every single part when there are many of them.
function frame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

export async function runNesting(
  parts: ParsedPart[],
  opts: NestingOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<NestResult> {
  const innerW = opts.sheetWidth - 2 * opts.margin;
  const innerH = opts.sheetHeight - 2 * opts.margin;

  // Sort by area descending — maior aproveitamento (única estratégia suportada)
  const sorted = [...parts].sort((a, b) => b.area - a.area);

  const rotations = opts.allowRotation ? buildRotationAngles(opts.rotationStep ?? 90) : [0];
  const mirrors = opts.allowMirror ? [false, true] : [false];

  const sheets: PlacedPart[][] = [[]];
  const unplaced: { partId: string; groupSig: string }[] = [];
  let totalArea = 0;

  // Candidate grid step (mm) — adaptive
  const step = Math.max(2, Math.min(opts.sheetWidth, opts.sheetHeight) / 100);

  const total = sorted.length;
  onProgress?.(0, total);
  let lastYield = typeof performance !== "undefined" ? performance.now() : Date.now();

  for (let idx = 0; idx < sorted.length; idx++) {
    const part = sorted[idx];
    let placed = false;

    // Try existing sheets first
    for (let s = 0; s < sheets.length && !placed; s++) {
      placed = tryPlace(part, s);
    }
    if (!placed) {
      // open new sheet
      sheets.push([]);
      placed = tryPlace(part, sheets.length - 1);
    }
    if (!placed) unplaced.push({ partId: part.id, groupSig: part.signature });
    else {
      totalArea += part.area;
      // bboxArea is added via the placed candidate below — accumulated in sheets
    }

    onProgress?.(idx + 1, total);

    // Only yield when enough wall-clock time has passed since the last yield, so we don't
    // slow down small/fast jobs while still keeping the UI responsive on heavy ones
    // (e.g. fine rotation steps like 5°/1° with many parts).
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastYield > 32) {
      await frame();
      lastYield = typeof performance !== "undefined" ? performance.now() : Date.now();
    }

    function tryPlace(part: ParsedPart, sheetIdx: number): boolean {
      const existing = sheets[sheetIdx];
      let best: PlacedPart | null = null;

      for (const mirror of mirrors) {
        for (const rot of rotations) {
          const { outer, holes } = transformGeom(part, rot, mirror);
          const b = bbox(outer);
          const w = b.maxX - b.minX;
          const h = b.maxY - b.minY;
          if (w > innerW || h > innerH) continue;

          // Inflated for collision (gap). Only the candidate is buffered — the existing
          // placed polygons are compared at their real size — so the candidate must be
          // grown by the FULL gap to guarantee the true clearance between two real part
          // outlines ends up being >= opts.gap.
          const inflated = opts.gap > 0 ? inflatePolygon(outer, opts.gap) : outer;

          // Bottom-left scan
          for (let y = 0; y + h <= innerH + 0.001; y += step) {
            for (let x = 0; x + w <= innerW + 0.001; x += step) {
              const placedPoly = translatePolygon(outer, x, y);
              const placedInflated = translatePolygon(inflated, x, y);
              const pb = bbox(placedPoly);

              let collides = false;
              for (const e of existing) {
                if (!bboxOverlap(pb, e.bbox, opts.gap)) continue;
                if (polygonsIntersect(placedInflated, e.polygon)) {
                  collides = true;
                  break;
                }
              }
              if (!collides) {
                const placedHoles = holes.map((hp) => translatePolygon(hp, x, y));
                const bboxW = pb.maxX - pb.minX;
                const bboxH = pb.maxY - pb.minY;
                const candidate: PlacedPart = {
                  partId: part.id,
                  groupSig: part.signature,
                  sheetIndex: sheetIdx,
                  rotation: rot,
                  mirrored: mirror,
                  x: x + opts.margin,
                  y: y + opts.margin,
                  polygon: translatePolygon(placedPoly, opts.margin, opts.margin),
                  holes: placedHoles.map((hp) => translatePolygon(hp, opts.margin, opts.margin)),
                  bbox: {
                    minX: pb.minX + opts.margin,
                    minY: pb.minY + opts.margin,
                    maxX: pb.maxX + opts.margin,
                    maxY: pb.maxY + opts.margin,
                  },
                  area: part.area,
                  bboxArea: bboxW * bboxH,
                };
                if (!best || candidate.bbox.minY < best.bbox.minY ||
                    (candidate.bbox.minY === best.bbox.minY && candidate.bbox.minX < best.bbox.minX)) {
                  best = candidate;
                }
                break; // first fit on this row
              }
            }
            if (best && best.bbox.minY <= y + opts.margin) break;
          }
        }
      }
      if (best) {
        existing.push(best);
        return true;
      }
      return false;
    }
  }

  const totalSheetArea = sheets.length * opts.sheetWidth * opts.sheetHeight;
  const totalBboxArea = sheets.flat().reduce((s, p) => s + p.bboxArea, 0);
  onProgress?.(total, total);
  return {
    sheets,
    unplaced,
    totalPartArea: totalArea,
    totalBboxArea,
    totalSheetArea,
    utilization: totalSheetArea ? totalBboxArea / totalSheetArea : 0,
  };
}