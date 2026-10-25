# Visitor activity and availability

Admin → **Visitor activity** shows guest and user page visits, browser visitor identifiers, signed-in account emails, visited paths, active-time estimates, server-seen IPs, device class and approximate country/region/city. Select a visitor for their page history; choose 24 hours, 7 days or 30 days and paginate through visits. The panel refreshes every 30 seconds.

The browser counts visible, focused time, pauses after 60 idle seconds and submits cumulative seconds every 15 seconds and on navigation/visibility changes. Retries cannot double-count a submitted total, and the server bounds time by the age of the visit. A browser that blocks analytics or is abruptly killed can leave an incomplete visit. Counts represent browser identifiers, not verified unique people.

Only paths are accepted: query strings, fragments, form values, document contents and passwords are excluded. Analytics uses a signed HttpOnly visitor cookie, separate from user/admin JWT cookies. Reports and mutations are protected by backend administrator role checks; control mutations additionally require CSRF. Analytics and controls are stored in `alltoolnexa_private.page_visits` and `alltoolnexa_private.site_controls` with RLS enabled and browser-role access revoked.

Public IP addresses are looked up server-side over HTTPS with ipwho.is and cached in memory. Its free endpoint allows commercial use but is rate limited (see https://ipwhois.io/documentation). A timeout/quota failure remains unknown; private, loopback and reserved addresses are shown as local/private without an external lookup. IP geolocation is approximate and is not GPS or proof of a person's address. No attempt is made to infer a hidden location behind a VPN.

Reports cover the last 30 days. Older records move to Trash; background maintenance purges expired Trash hourly while the backend runs. The public Privacy page and footer disclose analytics and the IP lookup provider.

### Manual history deletion

Visitor activity includes **6 hours, 1 day, 1 month, 6 months and 1 year** deletion presets. These mean visits that **started within the last selected period**, not visits older than that period. Month/year windows use calendar arithmetic, including month-end and leap-year handling. The current 30-day automatic storage policy still applies, so longer deletion windows include only records still present.

The initial delete action requests a protected preview containing exact dates, scope and matching count. The administrator must confirm in the dialog. A signed confirmation expires after five minutes and is bound to that administrator, visitor scope and fixed time window. Visits starting after the preview's end are excluded. Cancelling changes nothing. When a visitor filter is selected, deletion applies only to that visitor; otherwise the dialog explicitly says All visitors.

`POST /api/admin/analytics/delete-preview` and `POST /api/admin/analytics/delete` require admin JWT authentication and CSRF. Only `page_visits` rows are moved to Trash. Accounts, auth sessions, tool controls and documents are untouched. Successful deletion refreshes the displayed report and returns the actual deleted count. Records can be restored from Trash for 30 days before permanent deletion.

`node scripts/check-history-deletion.mjs` checks the presets and cancellation, then creates and deletes only an isolated synthetic visitor record to verify the complete UI/database path. It does not confirm deletion for all real visitors. Backend tests verify each window, scoped deletion, fixed preview boundaries, CSRF, invalid confirmations, leap years and preservation of non-analytics data.

The backend ignores client-supplied forwarded IP headers by default. Behind a real controlled reverse proxy, configure `TRUSTED_PROXY_HOPS` to exactly the number of trusted hops and prevent direct access around that proxy. See https://flask.palletsprojects.com/en/stable/deploying/proxy_fix/. Local `127.0.0.1` requests cannot demonstrate a visitor's public city.

Admin → **Tools & categories** controls individual tools and whole categories. Disabled entries stay visible but greyed out without clickable hrefs, and direct URLs show an unavailable message. An inactive category blocks all child tools even if an individual tool switch is on. DraftSheet shares the Spreadsheet Editor control; DraftWord has its own Office-category control. Existing open workspaces are unmounted when deactivated. Public availability is read during server render and refreshed every 5 seconds and on focus; failed refreshes retain the last known state. First loads without any state wait for availability rather than opening a potentially disabled tool.

All tools remain browser implementations; these switches control the website UI, not access to previously downloaded source code. They are not a licensing or DRM system.

## Validation

`backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v` (run from backend without the `backend/` prefixes). Coverage includes access/CSRF checks, persistence, category flags, guest/user attribution, visitor ownership, path sanitization, idempotent timing, forwarded-IP spoof rejection and honest location failures.

From frontend, `node scripts/check-site-operations.mjs` exercises the real admin switches, grey inactive links, direct URL blocking, already-open workspace blocking, category cascade, restoration, guest/user analytics and mobile panels. It restores the original two test control settings. Screenshots and the JSON report are written under `logs/`. `backend/scripts/cleanup-operations-fixture.py` removes only that isolated test account and browser history after the check.


Visitor Trash: deletions now move matching visits to Trash, excluding them from reports and heartbeats. Admin can restore each record within 30 days. Expired records cannot be restored and are permanently purged hourly while the backend is running, starting on its first request. `flask --app app:create_app purge-analytics-trash` also runs maintenance. Active records older than 30 days move to Trash; restored records get a fresh 30-day retention period without changing visit timestamps. Downtime delays physical cleanup until maintenance resumes.
