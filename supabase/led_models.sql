-- ─────────────────────────────────────────────────────────────────────────
-- Tabela compartilhada de modelos de LED
-- Rode este script no SQL Editor do seu projeto Supabase.
--
-- Diferente das outras tabelas do sistema (que usam RLS por usuário), esta
-- tabela é INTENCIONALMENTE compartilhada: todo usuário autenticado enxerga
-- e pode cadastrar/remover os mesmos modelos de LED, evitando que cada
-- pessoa recadastre os mesmos itens no seu próprio navegador.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.led_models (
  id         text primary key,           -- gerado no cliente, ex: "led-1737..."
  name       text not null,
  width      numeric not null check (width > 0),   -- mm
  height     numeric not null check (height > 0),  -- mm
  power      numeric not null default 0 check (power >= 0), -- W por unidade
  photo_url  text,                       -- data URL (base64) da foto do LED
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.led_models enable row level security;

-- Qualquer usuário autenticado pode LER o catálogo de LEDs
create policy "led_models_select_authenticated"
  on public.led_models for select
  to authenticated
  using (true);

-- Qualquer usuário autenticado pode CADASTRAR novos modelos
create policy "led_models_insert_authenticated"
  on public.led_models for insert
  to authenticated
  with check (true);

-- Qualquer usuário autenticado pode REMOVER modelos do catálogo compartilhado
-- (ajuste para "using (created_by = auth.uid())" se preferir que só quem
-- cadastrou possa remover)
create policy "led_models_delete_authenticated"
  on public.led_models for delete
  to authenticated
  using (true);

-- Índice auxiliar para ordenar por data de cadastro
create index if not exists led_models_created_at_idx on public.led_models (created_at);

-- Nota sobre fotos: hoje o app guarda a foto do LED como data URL (base64)
-- direto na coluna photo_url, o que é simples mas infla o tamanho da linha
-- para fotos grandes. Se isso virar um problema, migre para um bucket do
-- Supabase Storage (ex.: "led-photos") e guarde aqui apenas a URL pública.
