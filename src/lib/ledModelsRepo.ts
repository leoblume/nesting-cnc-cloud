import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { LedModel } from "@/components/NestingApp";

// ─── Repositório de modelos de LED ─────────────────────────────────────────
// Antes: cada navegador guardava sua própria lista em localStorage, então
// cada usuário via um catálogo diferente e "recadastrava" os mesmos LEDs.
//
// Agora: os modelos ficam numa tabela compartilhada no Supabase (Postgres),
// visível para todos os usuários autenticados. O localStorage passa a ser
// apenas um CACHE local — usado como fallback instantâneo enquanto a lista
// do servidor carrega, e como modo offline caso o Supabase não esteja
// configurado (ex.: ambiente de desenvolvimento sem variáveis de ambiente).
//
// Ver README / supabase/led_models.sql para o schema + policies de RLS.

const LOCAL_CACHE_KEY = "nestcnc_led_models";
const TABLE = "led_models";

interface LedModelRow {
  id: string;
  name: string;
  width: number;
  height: number;
  power: number;
  photo_url: string | null;
}

function rowToModel(row: LedModelRow): LedModel {
  return {
    id: row.id,
    name: row.name,
    width: row.width,
    height: row.height,
    power: row.power,
    photoUrl: row.photo_url ?? undefined,
  };
}

function readLocalCache(): LedModel[] {
  try {
    const saved = localStorage.getItem(LOCAL_CACHE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function writeLocalCache(models: LedModel[]) {
  try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(models)); } catch { /* ignore */ }
}

/** Retorna o cache local imediatamente (uso síncrono, ex.: valor inicial de useState). */
export function getCachedLedModels(): LedModel[] {
  return readLocalCache();
}

/**
 * Busca os modelos de LED no servidor (Supabase). Se o Supabase não estiver
 * configurado ou a requisição falhar (ex.: offline), cai para o cache local
 * — assim o app continua funcionável mesmo sem servidor.
 */
export async function fetchLedModels(): Promise<LedModel[]> {
  const supabase = getSupabase();
  if (!supabase) return readLocalCache();

  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, width, height, power, photo_url")
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.warn("[ledModelsRepo] Falha ao buscar LEDs do servidor, usando cache local:", error?.message);
    return readLocalCache();
  }

  const models = data.map(rowToModel);
  writeLocalCache(models); // mantém o cache local sincronizado
  return models;
}

/**
 * Cadastra um novo modelo de LED no servidor, para que todos os usuários
 * passem a enxergá-lo. Se o servidor não estiver configurado/disponível,
 * o modelo é salvo apenas localmente (modo offline).
 */
export async function createLedModel(model: LedModel): Promise<{ model: LedModel; savedToServer: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    const updated = [...readLocalCache(), model];
    writeLocalCache(updated);
    return { model, savedToServer: false };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id: model.id,
      name: model.name,
      width: model.width,
      height: model.height,
      power: model.power,
      photo_url: model.photoUrl ?? null,
    })
    .select("id, name, width, height, power, photo_url")
    .single();

  if (error || !data) {
    console.warn("[ledModelsRepo] Falha ao salvar LED no servidor, salvando apenas localmente:", error?.message);
    const updated = [...readLocalCache(), model];
    writeLocalCache(updated);
    return { model, savedToServer: false };
  }

  const saved = rowToModel(data);
  writeLocalCache([...readLocalCache(), saved]);
  return { model: saved, savedToServer: true };
}

/** Remove um modelo de LED do servidor (e do cache local). */
export async function deleteLedModel(id: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      console.warn("[ledModelsRepo] Falha ao remover LED no servidor:", error.message);
    }
  }
  writeLocalCache(readLocalCache().filter((m) => m.id !== id));
}

export { isSupabaseConfigured };
