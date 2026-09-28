# Deploying the GECKO TOS web UI

Target: one VM (Linux or Windows). The UI (`next start`) and Gecko.Api run side by side.
The browser only ever talks to the UI's origin; the UI proxies `/api/*` and `/auth/*` to the API.

```
browser --https--> reverse proxy (TLS) --http--> next start :3000 --http--> Gecko.Api :5100
                   (nginx / Caddy / IIS)          /api/*, /auth/* rewritten to the API
```

## 1. Environment variables

| Variable | Needed at | Default | Purpose |
|---|---|---|---|
| `GECKO_API_ORIGIN` | **build** (`npm run build`) | `http://localhost:5100` | Where `/api/*` and `/auth/*` are proxied. Plain http to the API on the same VM. No trailing slash. |
| `NEXT_PUBLIC_GECKO_MENU` | **build** | `pilot` in a production build, `full` in `next dev` | `pilot` shows only the screens bound to the API; `full` shows every screen, mock ones included. |
| `PORT` | run | `3000` | Port `next start` listens on. You can pass `-p` instead. |
| `NODE_ENV` | run | set to `production` by `next start` | Leave as is. |

**Both variables are baked in at build time.** `next build` writes the proxy target into
`.next/routes-manifest.json` and inlines `NEXT_PUBLIC_*` into the bundles. Setting them only when you
start the server does nothing. (Checked: starting the server with a different `GECKO_API_ORIGIN` still
proxied to the value from the build.) To change either one, rebuild.

Put them in `.env.production.local` next to `package.json` (git-ignored), and `next build` picks it up:

```
GECKO_API_ORIGIN=http://localhost:5100
NEXT_PUBLIC_GECKO_MENU=pilot
```

## 2. Menu edition (pilot / full)

The list is in `src/lib/edition.ts` (`PILOT_PATHS`). The same list drives three things:

- **Sidebar** (`src/components/layout/AppShell.tsx`): pilot mode shows only Bookings (register and new),
  Gate Desk, Yard Stock, Cash Window, Tariff Schedules, Customers, Vessel Call Schedule, Container
  Types, Order Types, Charge Codes and Holds. Modules with no live screen are hidden, and so is the
  "Demo · reset data" button.
- **Route guard** (`src/proxy.ts`, the Next 16 name for middleware): in pilot mode, a direct URL to
  any other screen shows the "Not available in this edition" page. The address bar keeps the URL
  that was typed, and no mock data is rendered.
- **Landing page**: after sign-in the user goes to `/gate/desk` in pilot mode and
  `/dashboard/overview` in full mode.

When you bind a new screen to the API, add its path to `PILOT_PATHS` and rebuild.

## 3. The one-origin proxy in production

`next.config.ts` → `rewrites()` forwards `/api/:path*` and `/auth/:path*` to `GECKO_API_ORIGIN`.
Because the browser sees a single origin, you need no CORS setup, and the refresh cookie keeps its
production attributes (`__Secure-`, `HttpOnly`, `SameSite=Strict`, `Path=/auth`).

**The browser must reach the UI over HTTPS.** Browsers refuse a `__Secure-` cookie over plain http.
Over http, sign-in looks like it works, then every token refresh fails. So put a TLS-terminating
reverse proxy in front of `next start` and forward **everything** (pages, `/api`, `/auth`) to the UI
port. Do not route `/api` to the API separately: the one-origin design depends on the UI doing that hop.

**Client IP.** The rewrite passes the incoming `X-Forwarded-For` / `X-Forwarded-Proto` through to the API
unchanged (Next adds only `X-Forwarded-Host`). The API trusts those headers only from loopback peers
(`ForwardLimit = 2`, `GeckoForwardedHeaders.cs`), which is what keeps the per-IP login limit per user.
So: the TLS proxy must set `X-Forwarded-For` (Caddy does by default; nginx below), and `next start` must
listen on `127.0.0.1` only (`-H 127.0.0.1`), never on a public interface.

nginx example:

```nginx
server {
  listen 443 ssl;
  server_name tos.example.com;
  ssl_certificate     /etc/letsencrypt/live/tos.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tos.example.com/privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Caddy (automatic certificates): `tos.example.com { reverse_proxy 127.0.0.1:3000 }`.
On Windows you can use IIS with URL Rewrite + ARR, or run Caddy for Windows.

Firewall: open only 443 (and 80 for the certificate challenge). Keep 3000 and 5100 closed to the outside.

## 4. Build and run

Node.js **22 LTS** (minimum 20.9 for Next 16; development uses 24.x). Check with `node --version`.

```bash
# on the VM, in the UI folder (a git clone, or a copy without node_modules/.next)
npm ci                       # exact versions from package-lock.json
# create .env.production.local (section 1) first
npm run build                # next build → .next/
npm run start -- -p 3000     # next start; or: npx next start -p 3000
```

Smoke test: `curl -I http://127.0.0.1:3000/login` should return 200. With the API up,
`curl http://127.0.0.1:3000/api/...` should return the API's answer.

Redeploy: `git pull && npm ci && npm run build`, then restart the service.

### Run as a service: Linux (systemd)

`/etc/systemd/system/gecko-tos-ui.service`:

```ini
[Unit]
Description=GECKO TOS web UI
After=network.target

[Service]
WorkingDirectory=/opt/gecko/web.tos.gecko-api
ExecStart=/usr/bin/npx next start -p 3000
Environment=NODE_ENV=production
Restart=always
User=gecko

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now gecko-tos-ui
journalctl -u gecko-tos-ui -f
```

### Run as a service: any OS (pm2)

```bash
npm i -g pm2
pm2 start npm --name gecko-tos-ui -- start -- -p 3000
pm2 save
pm2 startup        # Linux: prints the command that installs the boot hook
# Windows: npm i -g pm2-windows-startup && pm2-startup install
```

### Run as a service: Windows (NSSM)

```powershell
nssm install GeckoTosUi "C:\Program Files\nodejs\node.exe" "D:\gecko\web.tos.gecko-api\node_modules\next\dist\bin\next" start -p 3000
nssm set GeckoTosUi AppDirectory D:\gecko\web.tos.gecko-api
nssm set GeckoTosUi AppEnvironmentExtra NODE_ENV=production
nssm set GeckoTosUi AppStdout D:\gecko\logs\ui.out.log
nssm set GeckoTosUi AppStderr D:\gecko\logs\ui.err.log
nssm start GeckoTosUi
```

## 5. Notes

- `npm run dev` uses `--experimental-https` with local certificates. That is for development only.
  In production, TLS belongs to the reverse proxy.
- `npm run build` does not run ESLint (Next 16 removed that step). Type-checking does run and must
  pass. Run `npm run lint` on its own; the older mock screens still carry lint errors.
- If the API is down, pages still load, but API calls return 500 and the log shows
  `Failed to proxy http://localhost:5100/...`.
