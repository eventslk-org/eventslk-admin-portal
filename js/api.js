// ─────────────────────────────────────────────────────────────────────────────
// EventsLK Admin Portal — API client
//
// Talks ONLY to the Kong API gateway (the single external entry point). Kong
// proxies the backend paths as-is (strip_path: false), so we call them directly:
//   /auth/*   /event/*   /user/*   /book/*
//
// Base URL comes from window.ENV.API_BASE_URL (env-config.js, injected at runtime).
// ─────────────────────────────────────────────────────────────────────────────

function resolveApiBase() {
  const root = (window.ENV && window.ENV.API_BASE_URL) ? window.ENV.API_BASE_URL : '';
  return root.replace(/\/+$/, '');
}

class ApiService {
  // Must mirror EventController.ALLOWED_IMAGE_TYPES on the backend.
  static ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

  constructor() {
    this.user = JSON.parse(localStorage.getItem('admin_user') || 'null');
  }

  get baseUrl() {
    return resolveApiBase();
  }

  async request(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };

    if (this.user && this.user.jwtToken) {
      headers['Authorization'] = `Bearer ${this.user.jwtToken}`;
    }

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    let response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, config);
    } catch (networkErr) {
      console.error('Network error:', networkErr);
      throw new Error('Cannot reach the API gateway. Check that it is running and API_BASE_URL is correct.');
    }

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { message: text };
    }

    // Token expired / invalid — bounce to login.
    if (response.status === 401 && this.user) {
      this.logout();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }
    return data;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  async login(email, password) {
    const data = await this.request('/auth/login', 'POST', { email, password });
    if (data && data.status === 'login' && data.message === 'success') {
      const userData = Object.assign({}, data.user || { email }, { jwtToken: data.jwtToken });
      if (userData.role !== 'ADMIN') {
        throw new Error('Access denied: admin privileges required');
      }
      localStorage.setItem('admin_user', JSON.stringify(userData));
      this.user = userData;
      return data;
    }
    // Friendlier message for the common "email not verified" case.
    throw new Error(data.message === 'email not verified'
      ? 'This account has not verified its email address yet.'
      : (data.message || 'Login failed'));
  }

  logout() {
    localStorage.removeItem('admin_user');
    this.user = null;
    window.location.href = 'login.html';
  }

  isAuthenticated() {
    return this.user !== null && !!this.user.jwtToken;
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  getEvents() { return this.request('/event'); }
  addEvent(eventData) { return this.request('/event', 'POST', eventData); }
  updateEvent(eventData) { return this.request('/event', 'PUT', eventData); }
  deleteEvent(eventId) { return this.request(`/event/${encodeURIComponent(eventId)}`, 'DELETE'); }

  // ── Event image upload (presigned S3) ────────────────────────────────────────
  // 1) ask the backend for a presigned PUT URL, 2) PUT the file straight to S3
  // (no Authorization header — the presigned URL carries its own signature),
  // 3) return the public imageUrl to store on the Event.
  getUploadUrl(filename, contentType) {
    return this.request(
      `/event/upload-url?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`);
  }

  async uploadEventImage(file) {
    const contentType = (file.type || '').toLowerCase();
    if (!ApiService.ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw new Error(`Unsupported image type "${file.type || 'unknown'}". Use JPEG, PNG, WebP, AVIF or GIF.`);
    }

    const presign = await this.getUploadUrl(file.name, contentType);
    if (!presign || !presign.uploadUrl) {
      throw new Error('Failed to obtain an upload URL from the server.');
    }

    // Backend mock mode (no S3 bucket configured): there is no real storage to
    // PUT to — just use the placeholder imageUrl so local dev keeps working.
    if (presign.uploadUrl.includes('mock-upload-endpoint')) {
      console.warn('[upload] backend S3 is in mock mode — using placeholder image URL');
      return presign.imageUrl;
    }

    // Content-Type and Cache-Control are pinned into the presigned signature —
    // S3 rejects the PUT with 403 unless both headers match exactly.
    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
      body: file
    });
    if (!putRes.ok) {
      throw new Error(`Image upload to storage failed (HTTP ${putRes.status}).`);
    }
    return presign.imageUrl;
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  getUsers() { return this.request('/user'); }
  deleteUser(userId) { return this.request(`/user/${encodeURIComponent(userId)}`, 'DELETE'); }
}

const api = new ApiService();
