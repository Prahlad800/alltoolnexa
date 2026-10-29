# Category hierarchy

The public directory has five main categories, eighteen subcategories and 507 catalog tools. The source is `shared/taxonomy.mjs`; existing subcategory IDs and tool URLs are preserved. `npm run inventory` publishes the matching backend snapshots.

| Main category | Subcategories | Tools |
| --- | ---: | ---: |
| PDF & Image Tools | 3 | 68 |
| Documents & Education | 3 | 97 |
| Developer & QR Tools | 3 | 86 |
| Business & SEO Tools | 4 | 120 |
| Calculators & Utilities | 5 | 136 |

Browse `/categories`, then `/categories/pdf-image`, then `/categories/pdf`. `/tools?category=pdf-image` filters by the entire main category. Existing subcategory filters remain supported.

Admin **Tools & categories** controls main categories, subcategories and tools. All category levels use `POST /api/admin/controls` with `{ "kind": "category", "id": "pdf-image", "enabled": false }`. Tool controls use `kind: "tool"`. Administrator cookies, a trusted Origin and `X-CSRF-Token` are required. Parent controls take precedence; reactivating a parent preserves individually inactive children. Open website tabs refresh availability every five seconds.

`GET /api/public/categories` returns the nested hierarchy, tool counts and disabled item IDs. Admin controls include `mainCategories` and `categories`. DraftWord is an additional managed workspace outside the 507-tool catalog.

Admin **Recent users** lists public users with registration time, last login and account status. `GET /api/admin/users?sort=registered&page=1` or `sort=login` returns 50 users per page; access is private to administrators. Login time survives logout. Apply `backend` migration `0009_user_last_login` before restarting the API. Earlier timestamps are backfilled only from retained sessions; unknown timestamps remain null. Supabase HTTPS deployments must apply the migration/RPC through a PostgreSQL-connected environment first.

Local frontend and admin `NEXT_PUBLIC_API_URL` must match the running Flask origin. Run `node scripts/verify-taxonomy.mjs` from frontend for the browser workflow (installed Chrome required). It restores the tested category controls in `finally`.
