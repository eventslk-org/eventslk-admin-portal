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

All traffic goes to the **API Gateway** (the only externally reachable entry point); the
gateway routes to `event-registration-api`. The portal calls the gateway directly using the
public `/api/v1` prefix — no nginx API proxy.

```
Admin Browser ──HTTPS──▶ API Gateway (NodePort 30080)  ──▶ event-registration-api (ClusterIP)
   (env-config.js → window.ENV.API_BASE_URL)        /api/v1/{auth,events,users,book}
Admin Browser ──PUT───▶ S3 (presigned URL, event images, no auth header)
```

| Frontend call | Gateway → service |
|---|---|
| `POST /api/v1/auth/login` | `/auth/login` |
| `GET\|POST\|PUT /api/v1/events`, `DELETE /api/v1/events/{id}` | `/event...` |
| `GET /api/v1/events/upload-url?filename=` | `/event/upload-url` (presigned S3) |
| `GET /api/v1/users`, `DELETE /api/v1/users/{id}` | `/user...` |

> The shipped gateway only defines `auth` and `events` routes. Add the `users` (and `book`)
> routes from `../FRONTEND_INTEGRATION_SPEC.md` §2 or the Users page returns 404.

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
| `.env` | Source value: `API_BASE_URL=http://localhost:30080` |
| `env-config.template.js` | `window.ENV = { API_BASE_URL: "${API_BASE_URL}" }` |
| `env-config.js` | Committed default (used when serving statically) |
| `docker-entrypoint.sh` | Renders `env-config.js` from the template via `envsubst` on boot |

`js/api.js` reads `window.ENV.API_BASE_URL` and calls `${API_BASE_URL}/api/v1/...`.
In Kubernetes the value comes from the deployment's `API_BASE_URL` env var.

## Run locally

```bash
# 1) Point at your gateway
echo 'window.ENV = { API_BASE_URL: "http://localhost:30080" };' > env-config.js
# 2) Serve the folder
python3 -m http.server 3000
# open http://localhost:3000/login.html
```

## Build & run with Docker

```bash
docker build -t kaveengayanga12/eventslk-admin-portal:local .
docker run -p 8082:80 -e API_BASE_URL=http://localhost:30080 \
  kaveengayanga12/eventslk-admin-portal:local
```

The image installs `gettext` and renders `env-config.js` from `API_BASE_URL` at startup,
so the same image can be repointed at any gateway without a rebuild.
