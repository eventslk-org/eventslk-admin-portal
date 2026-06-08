// ─────────────────────────────────────────────────────────────────────────────
// EventsLK Admin Portal — API client
//
// Talks ONLY to the API Gateway (the single external entry point) using the
// public /api/v1 prefix. The gateway rewrites:
//   /api/v1/auth/*   -> /auth/*     /api/v1/events/* -> /event/*
//   /api/v1/users/*  -> /user/*     /api/v1/book/*   -> /book/*
//
// Base URL comes from window.ENV.API_BASE_URL (env-config.js, injected at runtime).
// ─────────────────────────────────────────────────────────────────────────────

const API_PREFIX = '/api/v1';

function resolveApiBase() {
  const root = (window.ENV && window.ENV.API_BASE_URL) ? window.ENV.API_BASE_URL : '';
  return root.replace(/\/+$/, '') + API_PREFIX;
}

class ApiService {
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
  getEvents() { return this.request('/events'); }
  addEvent(eventData) { return this.request('/events', 'POST', eventData); }
  updateEvent(eventData) { return this.request('/events', 'PUT', eventData); }
  deleteEvent(eventId) { return this.request(`/events/${encodeURIComponent(eventId)}`, 'DELETE'); }

  // ── Event image upload (presigned S3) ────────────────────────────────────────
  // 1) ask the gateway for a presigned PUT URL, 2) PUT the file straight to S3
  // (no Authorization header — the presigned URL carries its own signature),
  // 3) return the public imageUrl to store on the Event.
  getUploadUrl(filename) {
    return this.request(`/events/upload-url?filename=${encodeURIComponent(filename)}`);
  }

  async uploadEventImage(file) {
    const presign = await this.getUploadUrl(file.name);
    if (!presign || !presign.uploadUrl) {
      throw new Error('Failed to obtain an upload URL from the server.');
    }
    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!putRes.ok) {
      throw new Error(`Image upload to storage failed (HTTP ${putRes.status}).`);
    }
    return presign.imageUrl;
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  getUsers() { return this.request('/users'); }
  deleteUser(userId) { return this.request(`/users/${encodeURIComponent(userId)}`, 'DELETE'); }
}

const api = new ApiService();
