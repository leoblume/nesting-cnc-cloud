// ─── Catálogo estático de modelos de LED ───────────────────────────────────
// O cadastro de LEDs deixou de ser feito pela interface (por usuário) e
// passou a ser um arquivo texto único dentro do projeto — assim todos os
// usuários enxergam exatamente o mesmo catálogo, sem depender de servidor.
//
// Formato do arquivo (src/lib/leds/ledCatalog.txt):
//   linha 1: título — IGNORADA
//   linha 2: nomes das colunas — IGNORADA
//   linha 3 em diante: dados, uma linha por LED
//
// Colunas separadas por vírgula "," — linhas terminadas em ponto-e-vírgula ";"
//   nome, largura, altura, potência;
//
// Para adicionar/editar LEDs: basta editar ledCatalog.txt e gerar um novo
// build — não requer alterar nenhum código.
import ledCatalogRaw from "./ledCatalog.txt?raw";
import type { LedModel } from "./ledEngine";

function slugify(name: string, index: number): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `static-${base || "led"}-${index}`;
}

function parseLedCatalog(raw: string): LedModel[] {
  // Linhas terminadas em ";" — remove quebras de linha/CR e separa por ";"
  const rows = raw
    .replace(/\r/g, "")
    .split(";")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  // Linha 1 = título, linha 2 = cabeçalho das colunas — ambas ignoradas
  const dataRows = rows.slice(2);

  const models: LedModel[] = [];
  dataRows.forEach((row, i) => {
    const cols = row.split(",").map((c) => c.trim());
    if (cols.length < 4) return;

    const [name, widthStr, heightStr, powerStr] = cols;
    const width = parseFloat(widthStr.replace(",", "."));
    const height = parseFloat(heightStr.replace(",", "."));
    const power = parseFloat(powerStr.replace(",", "."));

    if (!name || !isFinite(width) || !isFinite(height) || !isFinite(power)) return;

    models.push({
      id: slugify(name, i),
      name,
      width,
      height,
      power,
    });
  });

  return models;
}

// Catálogo carregado uma única vez, no build — igual para todos os usuários.
export const STATIC_LED_MODELS: LedModel[] = parseLedCatalog(ledCatalogRaw);
