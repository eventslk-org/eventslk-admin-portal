// Runtime configuration for the Admin Portal.
//
// This committed file is the DEFAULT used when serving the static files directly
// (local dev, opening via a simple static server). In Docker/Kubernetes it is
// regenerated from env-config.template.js by docker-entrypoint.sh using the
// API_BASE_URL environment variable.
//
// Loaded before js/api.js, it exposes the gateway base URL as window.ENV.API_BASE_URL.
// Default targets the local Kong gateway (docker: eventslk-kong-apigw, port 8000).
window.ENV = {
  API_BASE_URL: "http://localhost:8000"
};
