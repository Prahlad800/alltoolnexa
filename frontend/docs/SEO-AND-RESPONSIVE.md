# Public SEO and responsive UI

Updated: 25 October 2026.

## UI

Public and admin applications use the same light theme tokens (pale background, white panels, blue/purple accents) and black dark theme. Document editing accents remain blue for DraftWord and green for DraftSheet. Admin has its own theme switch and uses the AllToolNexa logo. Theme preferences are stored per origin, including port.

Small screens use stacked forms, wrapping titles, accessible navigation and local horizontal scrolling for spreadsheet canvases, ribbons and admin tables. Complex tables retain their columns rather than squeezing their text. Admin's table region can receive keyboard focus. Reduced-motion preferences are respected.

## Discovery

- Public page metadata includes descriptions, canonical URLs, Open Graph and Twitter previews. The share image is a 1200 × 630 PNG using the public site's colors.
- Home, directory, category, information, pricing, office and individual tool pages have metadata. Tools retain their visible instructions, assumptions, FAQs and WebApplication/breadcrumb structured data.
- The site declares Organization and WebSite structured data; category and directory pages declare collections. Structured data contains no invented reviews or ratings.
- `sitemap.xml` contains canonical public routes, every catalog tool and every category. It excludes sign-in, account and obsolete redirect routes. No fabricated modification dates are emitted.
- Public `robots.txt` allows ordinary crawlers and explicitly allows OAI-SearchBot. APIs, account/sign-in and admin paths are excluded. The separate admin application blocks crawlers and has noindex metadata.
- Search/filter variants of the directory are noindex and canonicalize to `/tools`.
- No keyword stuffing, hidden SEO text, fake testimonials or indexing promises were added.

## Production configuration

This development server runs on loopback addresses. External search engines and AI crawlers cannot crawl a local address. Before deployment set `NEXT_PUBLIC_SITE_URL` to the real HTTPS public origin in the frontend and admin environments, set the backend/admin origins for that deployment, then rebuild. The existing origin validation rejects loopback and non-HTTPS production origins.

After publishing, check that hosting authentication, robots rules, CDN and firewall allow access to public pages and the sitemap. Submit the sitemap in the site's verified Google Search Console property. Domain verification requires the owner's account or DNS access; no verification tokens were invented. Search engines decide when or whether to crawl and index pages.

Google's AI features use ordinary SEO eligibility; no special AI markup or text file is required: https://developers.google.com/search/docs/appearance/ai-features

OAI-SearchBot controls discovery for ChatGPT search independently from GPTBot's training crawling: https://developers.openai.com/api/docs/bots

## Validation

Run `node scripts/check-responsive-seo.mjs` from `frontend`. It checks representative shared layouts at 320, 390, 768, 1024 and 1440 pixels, both admin login and all signed-in admin tabs, matching palette values, dark mode, canonical/description/share metadata, parsable JSON-LD, crawler rules and sitemap coverage. It writes screenshots and a JSON report under `logs/`. It requires the three local services and the installed Edge browser.
