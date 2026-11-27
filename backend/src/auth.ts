import { type JWTPayload } from 'jose';
import { verifyAccessToken } from './jwt';

/** Request-scoped claims of the verified JWT of the caller. */
declare module 'express-serve-static-core' {
  interface Request {
    authClaims?: JWTPayload;
  }
}

/** Reads the Authorization header, verifies the JWT, and stores its claims on the request. */
export const requireAuth = async (
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="myapp"');
    res.status(401).json({
      code: 'unauthorized',
      message: 'Missing Authorization: Bearer <JWT>',
    });
    return;
  }
  const claims = await verifyAccessToken(header.slice(7));
  req.authClaims = claims;
  next();
};

/** Authorization middleware: rejects the request when the JWT lacks the required realm role. */
export const requireRealmRole =
  (role: string) =>
  async (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ): Promise<void> => {
    const claims = req.authClaims;
    if (!claims) {
      res
        .status(401)
        .json({ code: 'unauthorized', message: 'Authentication required' });
      return;
    }
    const roles = (claims.realmRoles as string[] | undefined) ?? [];
    if (!roles.includes(role)) {
      res.status(403).json({
        code: 'forbidden',
        message: `Realm role "${role}" is required`,
      });
      return;
    }
    next();
  };
