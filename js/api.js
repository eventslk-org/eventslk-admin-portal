const API_BASE_URL = (window._env_ && window._env_.API_BASE_URL)
  ? window._env_.API_BASE_URL
  : 'http://localhost:8080';

class ApiService {
  constructor() {
    this.user = JSON.parse(localStorage.getItem('admin_user') || 'null');
  }

  async request(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.user && this.user.jwtToken) {
      headers['Authorization'] = `Bearer ${this.user.jwtToken}`;
    }

    const config = {
      method,
      headers
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { message: text };
      }
      
      if (!response.ok) {
        throw new Error(data.message || `API request failed with status ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async login(email, password) {
    const data = await this.request('/auth/login', 'POST', { email, password });
    if (data && data.status === "login" && data.message === "success") {
       // Successful login
       const userData = Object.assign({}, data.user || { email }, { jwtToken: data.jwtToken });
       if (userData.role !== 'ADMIN') {
         throw new Error('Access denied: admin privileges required');
       }
       localStorage.setItem('admin_user', JSON.stringify(userData));
       this.user = userData;
       return data;
    } else {
       throw new Error(data.message || 'Login failed');
    }
  }

  logout() {
    localStorage.removeItem('admin_user');
    this.user = null;
    window.location.href = 'login.html';
  }

  isAuthenticated() {
    return this.user !== null;
  }

  // Event APIs
  getEvents() { return this.request('/event'); }
  addEvent(eventData) { return this.request('/event', 'POST', eventData); }
  updateEvent(eventData) { return this.request('/event', 'PUT', eventData); }
  deleteEvent(eventId) { return this.request(`/event/${eventId}`, 'DELETE'); }

  // User APIs
  getUsers() { return this.request('/user'); }
  deleteUser(userId) { return this.request(`/user/${userId}`, 'DELETE'); }
}

const api = new ApiService();
