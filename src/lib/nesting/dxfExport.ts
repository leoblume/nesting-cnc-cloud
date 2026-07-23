// Exportação DXF (R12 ASCII) — gera geometria vetorial de corte a partir do
// resultado do nesting. Cada peça é escrita como LWPOLYLINE fechada (contorno
// externo + furos), preservando as coordenadas reais do polígono (não o
// bounding box), pronta para importação em software de corte CNC/laser.
import type { PlacedPart } from "./nesting";
import type { Polygon } from "./geometry";

const HEADER = (minX: number, minY: number, maxX: number, maxY: number) => `0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
9
$INSBASE
10
0.0
20
0.0
30
0.0
9
$EXTMIN
10
${minX}
20
${minY}
9
$EXTMAX
10
${maxX}
20
${maxY}
9
$MEASUREMENT
70
1
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
2
0
LAYER
2
CORTE
70
0
62
1
6
CONTINUOUS
0
LAYER
2
CHAPA
70
0
62
5
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

const FOOTER = `0
ENDSEC
0
EOF
`;

function polylineEntity(layer: string, poly: Polygon): string {
  if (poly.length < 2) return "";
  let out = `0
LWPOLYLINE
8
${layer}
90
${poly.length}
70
1
`;
  for (const p of poly) {
    out += `10
${p.x.toFixed(4)}
20
${p.y.toFixed(4)}
`;
  }
  return out;
}

/**
 * Gera o conteúdo de um arquivo DXF (texto) para uma chapa do nesting,
 * usando a geometria vetorial real das peças (contorno + furos) — pronta
 * para corte, e não apenas o retângulo de ocupação.
 */
export function buildSheetDxf(
  parts: PlacedPart[],
  sheetWidth: number,
  sheetHeight: number,
): string {
  let minX = 0, minY = 0, maxX = sheetWidth, maxY = sheetHeight;

  let entities = "";

  // Contorno da chapa (referência, camada separada)
  const sheetRect: Polygon = [
    { x: 0, y: 0 },
    { x: sheetWidth, y: 0 },
    { x: sheetWidth, y: sheetHeight },
    { x: 0, y: sheetHeight },
  ];
  entities += polylineEntity("CHAPA", sheetRect);

  for (const part of parts) {
    entities += polylineEntity("CORTE", part.polygon);
    for (const hole of part.holes) {
      entities += polylineEntity("CORTE", hole);
    }
    for (const p of part.polygon) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }

  return HEADER(minX, minY, maxX, maxY) + entities + FOOTER;
}

export function downloadDxf(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".dxf") ? filename : `${filename}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
