# Morocco Now — next working version

This archive is based on the existing Morocco Now project.

## Changes in this version
- Real OpenStreetMap view on `/map` instead of the decorative CSS-only map.
- Direction buttons for map markers using Google Maps directions.
- Clerk account synchronization: the local profile now uses the authenticated Clerk user's real name/email when available.
- Admin access in the UI is restricted to `VITE_ADMIN_EMAIL`.
- Server-side local user role is automatically set to `ADMIN` when `ADMIN_EMAIL` matches the authenticated Clerk email.
- AdSense-ready ad slot on the home page. It stays as a safe placeholder until the two AdSense variables are configured.
- No real payment is charged. Existing subscription flows remain provider-safe until a payment provider is configured.

## StackBlitz / Replit Secrets
Set these in the deployment's environment/secrets, not directly in source code:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PROXY_URL` (if your current deployment uses it)
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `VITE_ADMIN_EMAIL` — your administrator email
- `ADMIN_EMAIL` — the same administrator email (server-side)
- Optional AdSense: `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT`

Do not put an admin password such as `RAjawi22` in frontend code. A frontend password would be visible to every visitor.
