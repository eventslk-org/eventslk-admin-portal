# EventsLK — Admin Portal

A lightweight, responsive admin dashboard for EventsLK administrators to manage events
and users. Built with **HTML, CSS, and vanilla JavaScript**, served by **Nginx**, and
deployed as a container on Kubernetes.

> Full backend contract (services, request flow, every endpoint, env contract) lives in
> [`../FRONTEND_INTEGRATION_SPEC.md`](../FRONTEND_INTEGRATION_SPEC.md).

## Features

- **Dashboard** — totals for events, users, and available seats.
- **Event management** — create / edit / delete events with **price tiers**, **total &
  available seats**, and **direct-to-S3 image upload** (presigned URL).
- **User management** — list and delete users.
- **Auth** — JWT login with admin-only access (`role === 'ADMIN'`); token in `localStorage`.

## Architecture

All traffic goes to the **Kong API gateway** (the only externally reachable entry point);
Kong proxies the backend paths unchanged (`strip_path: false`), so the portal calls the
real backend paths directly — no `/api/v1` prefix, no nginx API proxy.

```
Admin Browser ──HTTPS──▶ Kong gateway (proxy :8000)  ──▶ event-registration-api
   (env-config.js → window.ENV.API_BASE_URL)              /{auth,event,user,book}
Admin Browser ──PUT───▶ S3 (presigned URL, event images, no auth header)
```

| Frontend call | Backend |
|---|---|
| `POST /auth/login` | `/auth/login` |
| `GET\|POST\|PUT /event`, `DELETE /event/{id}` | ADMIN role |
| `GET /event/upload-url?filename=&contentType=` | presigned S3 PUT (ADMIN) |
| `GET /user`, `DELETE /user/{id}` | ADMIN role |

### Image upload contract (presigned S3)

The presigned PUT signature pins **both** headers, so the browser PUT must send exactly:
`Content-Type: <the declared image type>` and
`Cache-Control: public, max-age=31536000, immutable`.
Allowed types: JPEG, PNG, WebP, AVIF, GIF. When the backend has no S3 bucket configured
(mock mode) the PUT is skipped and a placeholder image URL is stored instead.

## Pages

| File | Purpose |
|---|---|
| `login.html` | Admin sign-in |
| `index.html` | Dashboard stats |
| `events.html` | Events CRUD + image upload + price tiers + seats |
| `users.html`  | User list + delete |

## Runtime configuration (env)

Static pages can't read process env, so the gateway URL is injected at container start:

| File | Role |
|---|---|
| `.env` | Source value: `API_BASE_URL=http://localhost:8000` |
| `env-config.template.js` | `window.ENV = { API_BASE_URL: "${API_BASE_URL}" }` |
| `env-config.js` | Committed default (used when serving statically) |
| `docker-entrypoint.sh` | Renders `env-config.js` from the template via `envsubst` on boot |

`js/api.js` reads `window.ENV.API_BASE_URL` and calls `${API_BASE_URL}/auth|event|user/...`.
In Kubernetes the value comes from the deployment's `API_BASE_URL` env var.

## Run locally

```bash
# 1) Point at your gateway (Kong proxy; committed default already says this)
echo 'window.ENV = { API_BASE_URL: "http://localhost:8000" };' > env-config.js
# 2) Serve the folder
python3 -m http.server 3000
# open http://localhost:3000/login.html
```

## Build & run with Docker

```bash
docker build -t kaveengayanga12/eventslk-admin-portal:local .
docker run -p 8082:80 -e API_BASE_URL=http://localhost:8000 \
  kaveengayanga12/eventslk-admin-portal:local
```

The image installs `gettext` and renders `env-config.js` from `API_BASE_URL` at startup,
so the same image can be repointed at any gateway without a rebuild.
