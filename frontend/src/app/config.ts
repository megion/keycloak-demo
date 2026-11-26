/**
 * Demo configuration. In production these values come from environment
 * specific files; in dev (ng serve) /api is proxied to the backend via
 * proxy.conf.json, and in docker it is proxied by nginx.
 */
export const KEYCLOAK_URL = 'http://localhost:8080';
export const KEYCLOAK_REALM = 'myapp';
export const KEYCLOAK_CLIENT_ID = 'myapp-frontend';
export const API_BASE_URL = '/api';
