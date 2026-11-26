/**
 * API errors are mapped to a JSON body `{ code, message }` by the error handler
 * in server.ts. Status codes follow REST conventions:
 * 401 missing/invalid JWT, 403 authenticated JWT with insufficient roles,
 * 404 user not found, 502 Keycloak upstream failure, 500 unexpected.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorized = (message: string): ApiError =>
  new ApiError(401, 'unauthorized', message);

export const forbidden = (message: string): ApiError =>
  new ApiError(403, 'forbidden', message);

export const notFound = (message: string): ApiError =>
  new ApiError(404, 'not_found', message);

export const upstreamError = (message: string): ApiError =>
  new ApiError(502, 'keycloak_upstream_error', message);
