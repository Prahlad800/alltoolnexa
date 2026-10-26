# Razorpay monthly storage

Prices and decimal-byte quotas are defined in `data/plans.json`. The public UI uses the matching `frontend/shared/plans.json` snapshot; the plan contract test checks they agree. Update both together. Free: ₹0, 50 MB / 2 MB per file; Basic: ₹39, 200 MB / 20 MB; Pro: ₹89, 1 GB / 100 MB; Premium: ₹149, 5 GB / 500 MB; Premium Plus: ₹199, 10 GB / 1 GB.

Apply `python -m flask --app app:create_app db-upgrade` from backend. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in backend/.env, then restart the backend. Start with test keys. Enable automatic payment capture in Razorpay. Configure a publicly reachable HTTPS webhook at `/api/billing/webhook` for `payment.captured`; localhost needs a secure tunnel. Configure the frontend API origin and trusted backend origins together.

Authenticated checkout creates an INR order using the server price. Verification checks the HMAC signature, user ownership, gateway payment status, amount, currency and order ID before granting access. Only captured payments activate storage. Webhooks recover activation if the browser closes. Duplicate notifications do not extend access twice. Same-plan renewals extend the existing expiry by one calendar month; a different plan starts a new month. There is no automatic recurring charge. Expired accounts return to Free upload limits; existing files remain downloadable and deletable.

Admin → Plans & payments shows plan limits, configuration status and the latest 100 orders. The account dashboard uses active plan limits. Missing keys disable checkout. Browser prices cannot grant access.

App sync, saved version history, priority processing, 30-day recovery, automated refunds/disputes and recurring mandates are not implemented. The existing file backend stores bytes in PostgreSQL; large uploads require suitable deployment request, memory and database limits. No live payment is validated until keys are supplied and the full test checkout/webhook flow is exercised.

Implementation reference: https://razorpay.com/docs/server-integration/python/test-app/
