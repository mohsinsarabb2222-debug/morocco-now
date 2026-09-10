# Morocco Now / المغرب الآن

Morocco Now is a multilingual discovery platform for finding trusted Moroccan businesses, destinations, activities, and local context.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/morocco-now run dev` — run the Morocco Now web app
- `pnpm run typecheck` — full typecheck across all packages
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/morocco-now run build` — build the web artifact
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` plus the managed Clerk variables for authenticated flows

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Web: React, Vite, Wouter, TanStack Query, Tailwind CSS
- Build: Vite for the web artifact, esbuild for the API bundle

## Where things live

- `artifacts/morocco-now/` — public React/Vite product, routes, responsive UI, Clerk auth screens, and language switching
- `artifacts/api-server/src/routes/morocco.ts` — database-backed Morocco discovery and account API routes
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/api-client-react/src/generated/` — generated typed React Query hooks
- `lib/api-zod/src/generated/` — generated request/response validation schemas
- `lib/db/src/schema/morocco.ts` — Drizzle schema for Morocco content, users, reviews, favorites, plans, subscriptions, and contact messages

## Architecture decisions

- Clerk is the authentication direction; protected API routes use the Clerk session and never accept an admin password from source code.
- Payments are provider-aware: subscription requests remain pending/configuration-aware until a real provider is connected, with no fake success state.
- Morocco AI is grounded against published directory data and explicitly reports unavailable configuration instead of inventing an answer when the AI provider is not connected.
- The web app is served as the `morocco-now` artifact and calls the shared API through same-origin `/api` routes.

## Product

- Browse businesses, destinations, activities, and cities with search, filters, detail pages, map markers, opening hours, contact details, products, and services.
- Use English, French, Arabic, or Darija with RTL direction handling for Arabic and Darija.
- Sign in or create an account through Clerk, then save favorites and publish reviews.
- View business and tourist plan options without being told a payment succeeded when no payment provider is configured.
- Ask Morocco AI questions with a clear unavailable state until an AI integration is connected.

## User preferences

- Keep real database-backed behavior and honest unavailable states; do not fabricate payments, reviews, users, revenue, or AI answers.

## Gotchas

- Regenerate the typed API client and Zod schemas after changing `lib/api-spec/openapi.yaml`.
- The Morocco web Vite config requires `PORT` during manual builds; use the artifact workflow or pass `PORT` and `BASE_PATH`.
- Do not put credentials or administrative passwords in source code; use the managed environment and Clerk flows.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
