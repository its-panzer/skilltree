# Operations

The app listens on `127.0.0.1:4783` by default. `GET /health` returns service liveness without library contents. `/api/status` is authenticated outside localhost and reports configuration, library count, and activity totals. Credentials are never returned by either endpoint.

## Keep the Mac service running

`node scripts/install-macos-service.mjs` installs a user LaunchAgent for this checkout and starts the production build. It creates `data/private/service.json` with the label and plist path. The service restarts after a crash and starts when the user signs in. Build first. Logs live under `data/private/`.

After source changes: run the tests, rebuild, and run the installer again to restart. After skill changes: `npm run import`, then restart the service. Import from the curated sources manifest; inspect new sources before adding them.

## Remote access

Tailscale Serve persists its HTTPS proxy configuration. Keep it pointed at the loopback port. The `/mcp` endpoint uses a bearer token; store client configuration in a private file, never a URL or source commit. Token changes take effect after a service restart. Local stdio clients do not use the HTTP token.

Only devices on the tailnet can connect. Sleeping, powering off, signing out, or disconnecting this Mac interrupts service. Tailscale can expire its device key; inspect its normal connection status if remote access stops working.

Tailscale Serve strips incoming identity headers and supplies the authenticated user's identity to the loopback backend. Tagged devices do not receive user identity headers, so use the bearer-authenticated MCP endpoint from those devices. See the [official identity-header documentation](https://tailscale.com/docs/features/tailscale-serve#identity-headers).

## Backup and removal

Back up `data/private/` and `.env` securely. SQLite uses WAL mode; stop the service before copying the database files, or use SQLite's backup command. The copied bundles are snapshots; original sources remain authoritative.

To stop the LaunchAgent, read its label and path from `data/private/service.json`, then run `launchctl bootout gui/$(id -u) /path/to/the.plist`. Remove only that plist if uninstalling. Remove only Skilltree's Tailscale Serve port, preserving other services.

## Boundaries

- MCP retrieval never runs imported scripts.
- All remote MCP requests require a bearer token; the tailnet website also checks the configured Tailscale identity.
- No wildcard CORS, no public Funnel, no cloud skill upload, and no token in browser JavaScript.
- The private catalog is not an encrypted vault. Protect the Mac account and backups.
- Activity contains task queries and returned decisions. It is private and persistent; manage retention according to your own needs.
- Live work data and connectors referenced by a skill must still be accessible to its executing agent.
