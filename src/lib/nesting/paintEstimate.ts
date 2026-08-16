// ─── Estimativa de tinta por chapa ─────────────────────────────────────────
// Regra (definida pelo usuário): a quantidade de tinta necessária por chapa
// é escalonada pelo aproveitamento (% da área da chapa efetivamente usada
// pelas peças encaixadas):
//   • aproveitamento ≥ 50%        → 1 chapa cheia de tinta = 1 litro
//   • 25% ≤ aproveitamento < 50%  → 500 ml
//   • aproveitamento < 25%        → 200 ml
//
// Aplicado por chapa (não numa média geral), porque cada chapa é pintada
// separadamente — depois soma-se o total em ml/L para o orçamento.
export interface PaintEstimate {
  perSheetMl: number[]; // ml estimados, um valor por chapa
  totalMl: number;
}

export function estimatePaintMlForUtilization(utilization: number): number {
  if (utilization >= 0.5) return 1000;
  if (utilization >= 0.25) return 500;
  return 200;
}

export function estimatePaintForSheets(utilizations: number[]): PaintEstimate {
  const perSheetMl = utilizations.map(estimatePaintMlForUtilization);
  const totalMl = perSheetMl.reduce((s, v) => s + v, 0);
  return { perSheetMl, totalMl };
}

export function formatMl(ml: number): string {
  if (ml >= 1000) {
    const l = ml / 1000;
    return `${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)} L`;
  }
  return `${ml} ml`;
}
