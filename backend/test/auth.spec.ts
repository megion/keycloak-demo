import { requireRealmRole } from '../src/auth';
import type { Request, Response, NextFunction } from 'express';

/** Minimal stand-ins for Express Request/Response used by the middleware tests. */
function fakeResponse() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    }
  };
  return res;
}

describe('requireRealmRole', () => {
  it('passes when the token carries the required role', async () => {
    const req = { authClaims: { realmRoles: ['user', 'myapp-backend-audience'] } } as unknown as Request;
    const res = fakeResponse();
    const next = jest.fn() as NextFunction;
    await requireRealmRole('user')(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it('returns 403 when the role is missing', async () => {
    const req = { authClaims: { realmRoles: ['myapp-backend-audience'] } } as unknown as Request;
    const res = fakeResponse();
    const next = jest.fn() as NextFunction;
    await requireRealmRole('admin')(req, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect((res.body as { code: string }).code).toBe('forbidden');
  });

  it('returns 401 when no claims are present', async () => {
    const req = {} as unknown as Request;
    const res = fakeResponse();
    const next = jest.fn() as NextFunction;
    await requireRealmRole('user')(req, res as unknown as Response, next);
    expect(res.statusCode).toBe(401);
    expect((res.body as { code: string }).code).toBe('unauthorized');
  });
});
