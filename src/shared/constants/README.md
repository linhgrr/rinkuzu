# Shared constants

Current structure is intentionally small:

```text
src/shared/constants/
├── avatar.ts
├── folder.ts
└── routes.ts
```

Rules:

- Keep only real reusable constants here.
- Do not put utility functions in this folder.
- Date/display helpers live in `src/lib/formatters.ts`.
- API envelope + error-code contract lives in:
  - `src/lib/api/*`
  - `contracts/api-error-codes.json`

If a constant group grows large, add a focused file next to `routes.ts` instead of reviving a catch-all module.
