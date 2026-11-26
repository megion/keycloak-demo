import { Router } from 'express';
import { config } from './config';
import { requireAuth, requireRealmRole } from './auth';
import { fetchUserProfile, listGroups, getServiceAccountToken, buildUserInfo, toUserProfile } from './keycloak-admin';

/**
 * REST routes of the MyApp backend.
 * All /api routes require a Keycloak access token issued for this API's
 * audience (myapp-backend), except /api/health.
 */
export const apiRouter = Router();

/** GET /api/health – unauthenticated liveness probe (used by docker healthchecks). */
apiRouter.get('/health', async (_req, res) => {
  await getServiceAccountToken();
  res.json({ status: 'UP', keycloak: config.keycloakUrl, realm: config.realm });
});

/** GET /api/user-info – profile of the logged-in user, assembled from JWT claims and Keycloak. */
apiRouter.get('/user-info', requireAuth, requireRealmRole('user'), async (req, res) => {
  const claims = req.authClaims!;
  const profile = await fetchUserProfile(claims.sub as string);
  const groups = (await listGroups()).filter((group) => (claims.groups as string[] | undefined)?.includes(group.id));
  res.json(buildUserInfo(claims, profile, groups));
});

/** GET /api/users/:id – admin-only profile lookup of any realm user via the Keycloak Admin REST API. */
apiRouter.get('/users/:id', requireAuth, requireRealmRole('admin'), async (req, res) => {
  const profile = await fetchUserProfile(String(req.params.id));
  res.json(toUserProfile(profile));
});
