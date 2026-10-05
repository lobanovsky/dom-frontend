# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`dom-frontend` — admin UI for `dom-backend` (sibling repo `../dom-backend`, Go REST API): buildings, premises, owners with shares, residents, personal accounts and payers. Vanilla ES modules, **no build step, no npm dependencies**; served by Caddy. Must work on phones. UI text, comments and README are in Russian. Modeled on the author's `dr-notif-frontend` (same router/client/form/modal code).

## Commands

```bash
npm test                                  # node --test "js/**/*.test.js"
node --test js/lib/apiErrors.test.js      # single test file
caddy run --config dev/Caddyfile          # http://localhost:3000, proxies /api/* and /healthz to 127.0.0.1:8080
caddy validate --config deploy/Caddyfile --adapter caddyfile
docker build -t dom-frontend:test .
```

Run the backend first (`../dom-backend`: `set -a; . ./.env; set +a; go run ./cmd/server`). Tests cover only DOM-free code (`js/lib`, `router`, `api/client` with mocked `fetch`); verify UI changes in a browser at desktop and ~390px widths.

## Architecture

- **Same origin is mandatory**: backend has no CORS and uses HttpOnly cookie `dom_session`. Caddy (`deploy/Caddyfile`) proxies `/api/*` + `/healthz` to `dom-backend:8080`; `trusted_proxies private_ranges` is required so Traefik's `X-Forwarded-Proto: https` reaches the backend (otherwise the cookie loses `Secure`).
- `js/app.js` bootstraps with `GET /api/v1/auth/me` (401 → login router, else shell router). `js/api/client.js` is the only `fetch`: 401 → `onUnauthenticated`, status 0/5xx → global toast; 4xx are handled by pages/forms.
- Backend errors are English `{"error": "..."}` — either `field: reason` (422) or fixed phrases (duplicate constraint, FK conflict, share sum). `js/lib/apiErrors.js` translates them and maps to a form field; add new backend messages/constraint names there.
- Forms: `js/pages/fields.js` describes fields per entity (names = API JSON fields). `ui/form.js` renders them (supports `type: 'picker'` custom components, `visible()`, `full`, function-of-values fields with `watch`). `lib/payload.js` converts form strings to the API body: backend uses **PUT with full replacement**, so every field is sent; empty/hidden → `null`; `virtual` fields (e.g. `owner_kind` switch person/legal entity) are not sent; `fixed` adds parent ids.
- `ui/crudList.js` — reusable list (filters → query params, pagination by `limit/offset`, modal create/edit, delete with confirm) used by directory pages and the building page. `pages/premises/premisesPage.js` is the main hand-built screen (owners via `GET /premises/{id}/ownerships`, accounts via `GET /premises/{id}/accounts`, residents/payers resolved to names through a per-page cache).
- Person contacts are lists (`phones`, `emails`, first = primary): form field `type: 'list'` renders `ui/listInput.js` (same component mechanism as `picker`); `lib/payload.js` sends trimmed non-empty strings and `[]` — never `null` — because the backend stores them `NOT NULL`. Backend error texts for contacts (`phones: "123": must contain at least 5 digits`) are translated in `lib/apiErrors.js`.
- **Soft delete**: `api.remove` = `DELETE` marks the row deleted, `api.restore` = `POST .../{id}/restore`. `ui/crudList.js` has a «Удалённые» toggle (`?deleted=only`, add button hidden, rows get «Восстановить»); `premisesPage.js` has per-block toggles (`showDeleted`) and `pages/common.js#deletedBanner` is shown for a deleted premises/building opened by link (backend `Get` returns deleted rows with `deleted_at`). Backend guard errors (`cannot delete: has active X`, `cannot save: X is deleted`) are translated in `lib/apiErrors.js`. Gotcha: `replaceChildren(null)` renders the text «null» — filter null children.
- `ui/picker.js` searches persons/legal entities via backend `q` filter; with `allowCreate` it has a «Найти в базе / Новое физлицо» toggle, the second mode is `ui/personCreate.js` (plain fields, not a nested `<form>` — forms can't nest — submitted by button).
- **Import from xlsx**: button «Импорт из Excel» on the building page opens `ui/importDialog.js` → `buildingsApi.importFile` (`POST /buildings/{id}/import`, multipart `kind` + `file`). `api/client.js` passes `FormData` through without a JSON `Content-Type`; `ApiError.rows` carries the backend's per-row errors (`[{row, error}]`), translated by `describeImportRowError` in `lib/apiErrors.js`. The import is all-or-nothing and backend-side format docs live in `../dom-backend/README.md`.
- Mobile: single breakpoint 768px; tables become cards via `td[data-label]` CSS; modals become bottom sheets; nav is an off-canvas drawer. SVG must be created from markup (`html:`), not `el('svg')` (wrong namespace).

## Deploy

`.github/workflows/build-and-deploy-frontend.yml`: test → Docker Hub → SSH deploy to `DEPLOY_HOST_PROJECT_PATH` with `/healthz` check (goes through Caddy to the backend) and rollback. Container `dom-frontend` joins external networks `dom-network` and `housekpr-network` (Traefik); the workflow only checks they exist, never creates them. Traefik issues the Let's Encrypt cert from compose labels (router `dom-frontend`, host `dom.lobanovsky.ru`, resolver `letsEncrypt`, HTTP-01) — don't rename the router/host or touch Traefik config, to avoid repeated issuance and LE rate limits.
