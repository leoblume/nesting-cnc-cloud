# NestCNC

## Deploy no Cloudflare Pages

Este projeto é uma SPA estática (Vite + React + TanStack Router). O deploy é feito
via **Cloudflare Pages**, conectado diretamente ao repositório do GitHub.

Configuração do build (usada na criação do projeto no dashboard da Cloudflare):

| Campo | Valor |
|---|---|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (ou a pasta do projeto, se o repo tiver subpastas) |
| Node version | `20` (definida pelo arquivo `.nvmrc`) |

### Variáveis de ambiente (Supabase)

Se o app usa o Supabase compartilhado (em vez do cache local via `localStorage`),
defina estas variáveis em **Settings → Environment variables** do projeto no
Cloudflare Pages (em Production e em Preview):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Sem essas variáveis o app cai automaticamente para o `localStorage` (ver
`src/lib/ledModelsRepo.ts`).

### Roteamento SPA

O arquivo `public/_redirects` (`/* /index.html 200`) garante que rotas internas
do TanStack Router funcionem corretamente ao recarregar a página ou acessar uma
URL direta — é o equivalente ao redirect que antes estava no `netlify.toml`.
