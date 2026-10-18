import type { ErrorCode } from '@spieleblock/shared';

export class ApiError extends Error {
  constructor(readonly code: ErrorCode, message?: string) {
    super(message ?? code);
  }
}

export const isApiError = (e: unknown, code?: ErrorCode): e is ApiError => e instanceof ApiError && (!code || e.code === code);
