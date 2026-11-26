import 'dotenv/config';

/**
 * Runtime configuration of the backend. Every value is environment driven;
 * the defaults point at the local docker-compose stack (Keycloak on :8080).
 */
export const config = {
  /** TCP port the REST API listens on. */
  port: Number(process.env.PORT ?? 3000),
  /** Keycloak base URL, trailing slash stripped. */
  keycloakUrl: (process.env.KEYCLOAK_URL ?? 'http://localhost:8080').replace(/\/$/, ''),
  /** Keycloak realm the API authenticates against. */
  realm: process.env.KC_REALM ?? 'myapp',
  /** Confidential client id representing this API (the expected JWT audience). */
  backendClientId: process.env.KC_BACKEND_CLIENT_ID ?? 'myapp-backend',
  /** Client secret of the backend's service account (client_credentials grant). */
  backendClientSecret: process.env.KC_BACKEND_CLIENT_SECRET ?? 'myapp-backend-service-account-secret',
  /** Browser origins allowed to call the API (CORS). */
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4200').split(',')
};

if (!config.backendClientSecret) {
  throw new Error('KC_BACKEND_CLIENT_SECRET must be set in the environment');
}
