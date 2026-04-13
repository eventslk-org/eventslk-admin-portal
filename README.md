# Admin Frontend

The Admin Frontend is a lightweight, responsive web interface for EventSLK administrators to manage events and users. It is built with HTML, CSS, and vanilla JavaScript, served by Nginx, and deployed as a containerized application on Kubernetes.

## Features

- **Dashboard**: Overview of total events and users in the system.
- **Event Management**: Create, view, update, and delete events.
- **User Management**: View all registered users and remove users as needed.
- **Authentication**: JWT-based login with role-based access control (admin role required).
- **Responsive Design**: Modern glassmorphism UI with mobile-friendly layout.

## Architecture

```
Request Flow:
Admin Browser → Nginx (port 80) → API routes proxy to backend (http://backend:8080)
                              → Static files served directly
```

Nginx routes:
- `/` → serves static HTML, CSS, JS files.
- `/api/*` → proxied to `http://backend:8080/` (backend API).

## Pages and Routes

| Page | File | Purpose |
|------|------|---------|
| Login | `login.html` | Admin authentication (email + password). |
| Dashboard | `index.html` | Overview statistics and system health. |
| Events | `events.html` | Create, view, edit, and delete events. |
| Users | `users.html` | View and delete user accounts. |

## Styling and Design

- **CSS**: `css/style.css` contains all styling using CSS custom properties (dark theme with glassmorphism).
- **Color Scheme**: 
  - Primary (Indigo): `#4F46E5`
  - Danger (Red): `#ef4444`
  - Success (Green): `#10b981`
  - Background (Dark): `#0f172a`
- **Fonts**: Inter (Google Fonts) for modern typography.

## Prerequisites

- Node.js (optional, for local HTTP server if not using Docker).
- Docker and Docker Compose (for containerized deployment).
- Backend API running (at `http://backend:8080` or configured via environment).

## Local Development

### Quick Static Serve with Python

```bash
cd admin-frontend
python3 -m http.server 8082
```

Then open `http://localhost:8082/` in your browser.

**Note**: API calls to `/api/*` will fail locally unless you:
1. Run the backend separately and update Nginx configuration, or
2. Set up the proper proxy environment.

### With Docker (Recommended)

Build the image:

```bash
cd admin-frontend
docker build -t eventslk-admin-portal:local .
```

Run the container:

```bash
docker run -d \
  -p 8082:80 \
  --name eventslk-admin \
  --network host \
  eventslk-admin-portal:local
```

Access at `http://localhost:8082/` and login with admin credentials.

### With Docker Compose

From the project root:

```bash
docker-compose up admin-frontend
```

## Docker Build

### Multi-Stage Build (if using)

The `Dockerfile` uses a single-stage Nginx Alpine image:

```dockerfile
FROM nginx:alpine

# Copy static files
COPY index.html login.html events.html users.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/

# Custom Nginx config for API proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
```

Build:

```bash
docker build -t kaveengayanga12/eventslk-admin-portal:latest .
```

Push to registry:

```bash
docker push kaveengayanga12/eventslk-admin-portal:latest
```

## Kubernetes Deployment

The deployment is defined in `k8s-manifests/admin-portal-deployment.yaml` and includes:

- **Service Type**: NodePort (exposes port `30082`).
- **Node Selection**: `nodeSelector: node-role=application`.
- **Replicas**: 1.
- **Health Checks**: Readiness and liveness probes on `/`.

### Apply to Cluster

```bash
kubectl apply -f k8s-manifests/admin-portal-deployment.yaml
```

### Access

- **Cluster Internal**: `http://admin-portal/`
- **External via NodeIP**: `http://<NodeIP>:30082/`

Example: `http://44.196.73.203:30082/`

## Authentication and Authorization

### Login Flow

1. User enters email and password on `login.html`.
2. Frontend calls `POST /auth/login` via `ApiService`.
3. Backend validates credentials and returns `{ jwtToken, user, message, status }`.
4. Frontend stores JWT in `localStorage` as `admin_user` JSON object.
5. JWT is added to all subsequent API requests via `Authorization: Bearer <token>` header.

### Role-Based Access Control

- Backend enforces `role === 'ADMIN'` for admin endpoints.
- Frontend checks `api.isAuthenticated()` before rendering protected pages.
- Unauthorized users are redirected to `login.html`.

### Session Management

- **Login**: Save token and user data to `localStorage`.
- **Logout**: Clear `localStorage` and redirect to `login.html`.
- **Session Persistence**: Token persists across browser refresh until manually logged out.

## API Integration

### API Service (`js/api.js`)

All API calls are made through the `ApiService` class:

```javascript
const api = new ApiService();
```

Methods:

```javascript
// Authentication
await api.login(email, password);
await api.logout();
await api.isAuthenticated();

// Events
await api.getEvents();
await api.addEvent(eventData);
await api.updateEvent(eventData);
await api.deleteEvent(eventId);

// Users
await api.getUsers();
await api.deleteUser(userId);
```

### Base URL

- **API Base**: `/api` (proxied by Nginx to `http://backend:8080/`)
- **Inside K8s**: Nginx is on same Pod, proxy resolves to backend Service DNS.
- **Direct calls**: If needed, raw fetch can target `http://backend:8080/` directly.

## Environment Configuration

### Environment Variables

The frontend respects the following environment variables at runtime:

- `API_BASE_URL` (default: `/api`): Override the API base path for development.

### Configuring API Endpoint

Edit `nginx.conf` to change the backend upstream:

```nginx
location /api/ {
    proxy_pass http://backend:8080/;
    # ...
}
```

Or in Kubernetes deployment, override via init container or ConfigMap if dynamic configuration is needed.

## Security Considerations

- **JWT Storage**: Token stored in `localStorage` (vulnerable to XSS). For production, consider:
  - HTTP-only cookies.
  - Session tokens managed server-side.
  - Content Security Policy (CSP) headers.

- **CORS**: Backend has `@CrossOrigin` enabled; review before production.

- **Credentials**: Never hardcode credentials; use environment variables or secrets.

- **HTTPS**: Always use HTTPS in production.

## Browser Compatibility

- Modern browsers with ES6 support.
- No polyfills or build step required (vanilla JavaScript).
- Responsive design supports mobile, tablet, and desktop.

## Troubleshooting

### API Requests Fail (404, Network Error)

**Issue**: `/api/*` requests fail or return 404.

**Cause**: Backend is not running or Nginx proxy is misconfigured.

**Solution**:
1. Check backend is running: `curl http://backend:8080/auth`
2. Verify Nginx proxy in `nginx.conf`.
3. If in Kubernetes, verify backend service DNS name (`backend`).

### Login Fails

**Issue**: "Login failed" error or 401 response.

**Cause**: Invalid credentials, backend down, or JWT_SECRET mismatch.

**Solution**:
1. Verify backend is running.
2. Check admin user exists in DB.
3. Verify JWT_SECRET environment variable in backend deployment.

### 403 Access Denied

**Issue**: "Access denied: admin privileges required."

**Cause**: Logged-in user does not have `role: 'ADMIN'`.

**Solution**:
1. Create or update a user with `ADMIN` role via backend.
2. Log in with correct admin account.

### Blank Page or Styling Issues

**Issue**: Page loads but appears blank or unstyled.

**Cause**: CSS or JavaScript files not loading, or CORS policy.

**Solution**:
1. Check browser console for 404 errors.
2. Verify Nginx is serving static files from `/usr/share/nginx/html/`.
3. Ensure `nginx.conf` does not block CSS/JS routes.

## Development Guidelines

### Modifying Pages

1. Edit the HTML file directly (e.g., `events.html`).
2. Keep inline `<script>` tags or reference external JavaScript in `js/`.
3. Test locally with `python3 -m http.server` or Docker.

### Extending API Methods

Add new methods to the `ApiService` class in `js/api.js`:

```javascript
async getEventById(eventId) {
  return this.request(`/event/${eventId}`, 'GET');
}
```

### Adding Pages

1. Create a new HTML file (e.g., `bookings.html`).
2. Include the same header structure, authentication check, and sidebar.
3. Reference `api.js` and `css/style.css`.
4. Add a new navigation link in the sidebar of all pages.

### Styling

All colors and spacing use CSS custom properties. To customize:

```css
:root {
  --primary-color: #4F46E5;
  --danger-color: #ef4444;
  /* ... */
}
```

Update `css/style.css` and rebuild the Docker image.

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/main.yml`) automates:

1. **Build** the Docker image on push to `main`.
2. **Push** the image to Docker Hub with:
   - Commit SHA tag (e.g., `a3a077933d...`).
   - `latest` tag.
3. **Update** the external Kubernetes manifests repository with the new image tag.
4. **Deploy** via GitOps (ArgoCD or manual `kubectl apply`).

To manually trigger a deployment after changes:

```bash
git add .
git commit -m "Update admin panel features"
git push origin main
```

The workflow will:
- Build and push `kaveengayanga12/eventslk-admin-portal:<commit-sha>`.
- Update `admin-portal-deployment.yaml` in the manifests repo.

## License

This module is part of the EventSLK platform. See the top-level `LICENSE` for licensing information.

## Support and Contribution

For issues or feature requests, refer to the main EventSLK repository's issue tracker.

For local development support, see [../README.md](../README.md) for system-wide setup instructions.
