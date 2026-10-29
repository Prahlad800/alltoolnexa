# Razorpay monthly and annual storage

Prices and decimal-byte quotas are defined in `data/plans.json`. The public UI uses the matching `frontend/shared/plans.json` snapshot; the plan contract test checks they agree. Update both together. Free: ₹0, 50 MB / 2 MB per file; Basic: ₹39, 200 MB / 20 MB; Pro: ₹89, 1 GB / 100 MB; Premium: ₹149, 5 GB / 500 MB; Premium Plus: ₹199, 10 GB / 1 GB.

Apply `python -m flask --app app:create_app db-upgrade` from backend. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in backend/.env, then restart the backend. Start with test keys. Enable automatic payment capture in Razorpay. Configure a publicly reachable HTTPS webhook at `/api/billing/webhook` for `payment.captured`; localhost needs a secure tunnel. Configure the frontend API origin and trusted backend origins together.

Authenticated checkout creates an INR order using the server price. Verification checks the HMAC signature, user ownership, gateway payment status, amount, currency and order ID before granting access. Only captured payments activate storage. Webhooks recover activation if the browser closes. Duplicate notifications do not extend access twice. Same-plan renewals extend the existing expiry by one calendar month or twelve calendar months according to the server-created order amount; a different plan starts its selected period from payment time. Calendar arithmetic clamps leap days and month-end dates. There is no automatic recurring charge. Expired accounts return to Free upload limits; existing files remain downloadable and deletable.

Admin → Plans & payments shows plan limits, configuration status and the latest 100 orders. The account dashboard uses active plan limits. Missing keys disable checkout. Browser prices cannot grant access.

App sync, saved version history, priority processing, 30-day recovery, automated refunds/disputes and recurring mandates are not implemented. The existing file backend stores bytes in PostgreSQL; large uploads require suitable deployment request, memory and database limits. No live payment is validated until keys are supplied and the full test checkout/webhook flow is exercised.

Implementation reference: https://razorpay.com/docs/server-integration/python/test-app/


## Annual price contract

| Plan | Monthly | Annual total | Monthly equivalent | Annual savings |
| --- | ---: | ---: | ---: | ---: |
| Basic | ₹39 | ₹349 | ₹29.08 | ₹119 / 25.4% |
| Pro | ₹89 | ₹949 | ₹79.08 | ₹119 / 11.1% |
| Premium | ₹149 | ₹1,599 | ₹133.25 | ₹189 / 10.6% |
| Premium Plus | ₹199 | ₹2,000 | ₹166.67 | ₹388 / 16.2% |

The monthly-equivalent figures are informational rounded averages. Annual checkout charges the exact annual total once, never twelve rounded monthly equivalents. Discounts compare that total with twelve monthly payments. Free stays free in both views.

Order creation accepts `billingCycle: monthly | yearly`, defaults old clients to monthly, and ignores client amount/expiry fields. The immutable server-created order amount distinguishes annual orders without adding a database column. Verification, ownership, captured-payment checks and webhook idempotency remain mandatory. Future price changes must keep historical amount-to-period mappings unambiguous and update the Python/JSON and RPC price contracts together.

### Safe deployment and existing Supabase installations

Migration `0008_annual_billing` replaces the existing restricted RPC in `migrations/supabase_backend.sql`; there are no table/data changes. Run `flask --app app:create_app db-upgrade` with the existing trusted PostgreSQL configuration. Alternatively, run the complete `backend/migrations/supabase_backend.sql` file in the correct Supabase project's SQL Editor. Its service-role permissions are retained. The migration's downgrade deliberately retains this backwards-compatible function so pending captured annual orders can still receive the correct duration.

The deployment helper first checks the current RPC capability. If annual support is missing and the existing server environment has a matching Supabase direct/session-pooler DATABASE_URL, the runner applies this transactional function update using that existing binding. It verifies the project identity from hostname or pooler username, keeps SSL enabled and never logs values. If no matched accessible binding is available, ordinary deployment and monthly checkout continue; apply the SQL through the trusted console. No new credential is required just to display annual prices.

`GET /api/billing/plans` advertises `billingCycles`. A legacy or unavailable RPC advertises monthly only; yearly order creation is rejected before contacting Razorpay. The backend also requires the RPC annual-price contract to match the JSON catalog before enabling yearly orders; the frontend checks the resulting capability too. Never enable annual charges against an RPC that grants only one month. After applying the update, confirm `billingCycles` contains `yearly` and test checkout with Razorpay test keys. Live charges are not used in automated validation.
