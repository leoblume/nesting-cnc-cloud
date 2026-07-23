# NestCNC

## Deploy no Cloudflare (Workers Builds)

Este projeto é uma SPA estática (Vite + React + TanStack Router). O deploy é
feito via **Workers Builds**, o CI/CD nativo da Cloudflare conectado ao
GitHub. Ele builda o projeto e implanta via **Wrangler**, usando o arquivo
`wrangler.jsonc` na raiz do projeto (já configurado para servir `./dist` como
uma SPA).

Configuração usada na tela de "Import a repository / Set up deployment":

| Campo | Valor |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Path (root directory) | `/` (ou a subpasta do projeto, se o repo tiver subpastas) |

### Variáveis de ambiente (Supabase)

Como o Vite faz a leitura de `VITE_*` **em tempo de build** (não em runtime),
essas variáveis precisam ser cadastradas como **Build variables and secrets**
(não como "Variables & Secrets" do Worker em runtime, que só afeta o próprio
Worker depois de implantado):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Sem essas variáveis o app cai automaticamente para o `localStorage` (ver
`src/lib/ledModelsRepo.ts`).

### Roteamento SPA

O `wrangler.jsonc` já define `not_found_handling: "single-page-application"`,
o que faz o Worker servir `index.html` para qualquer rota que não bata com um
arquivo do build — necessário para as rotas internas do TanStack Router
funcionarem ao recarregar a página. O arquivo `public/_redirects` foi mantido
por precaução, mas não é mais necessário nesse fluxo (era usado no Netlify e
no antigo Cloudflare Pages clássico).
