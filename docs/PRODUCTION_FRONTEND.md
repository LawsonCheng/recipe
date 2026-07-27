# Production frontend and GitHub Pages

## Build architecture

- The source of truth remains `src/data/recipes.json`.
- Vite emits a separate, hashed `recipes.runtime-*.json` file for the browser.
- Image-generation-only fields (`imagePrompt`, `imageSeed`, `visual`, and related
  metadata) are removed from the runtime copy at build time. Authoring data is not
  changed.
- The app shell loads first, then fetches and validates the runtime recipe list.
- Recipe cards render 24 at a time. Searching and filtering still cover all 300
  recipes.

## GitHub Pages paths

The deploy workflow sets `VITE_BASE_PATH` automatically:

- project repository: `/<repository-name>/`
- `username.github.io` repository: `/`

The same production HTML is copied to `404.html`. Recipe links use a query string
such as `?recipe=hong-kong-sweet-and-sour-pork`, so they can be reloaded and shared
without depending on server-side routing.

To reproduce a project-page build locally:

```sh
VITE_BASE_PATH=/rceipe-web/ npm run build
VITE_BASE_PATH=/rceipe-web/ npm run preview
```

## Resilience and diagnostics

- Loading, empty-data, request failure, and retry states are visible and
  translated.
- Missing images never receive a stock/default replacement. The reserved media
  area shows a neutral unavailable message.
- Image failures are observable through the `home-table:diagnostic` browser event
  and the last 100 records in `window.__HOME_TABLE_DIAGNOSTICS__`.
- Preferences and cooked history use a versioned local-storage envelope. Legacy
  values are migrated and malformed values are constrained before use.
- If browser storage is unavailable, the interface reports it instead of silently
  claiming that a record was persisted.

## Frontend acceptance checks

- Production build has no Vite warnings.
- Main JavaScript contains no recipe authoring JSON.
- `404.html` exists and uses the configured base path.
- Mobile portrait (390 × 844): no horizontal overflow.
- iPad landscape (1024 × 768): no horizontal overflow.
- Recipe query link survives a full reload.
- First page renders 24 lazy-loaded cards, with access to all 300 through search,
  filters, random selection, and “show more”.
- Production console has no errors or warnings when assets are present.
