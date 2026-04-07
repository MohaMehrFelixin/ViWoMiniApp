// Centralized error extraction for ky/HTTP errors. Reads the backend's
// structured `{ error: { code, message } }` envelope and falls back to a
// generic message if the body isn't parseable.
//
// Used everywhere instead of empty `catch {}` blocks (FIX B5).

import { HTTPError } from "ky";

export async function extractErrorMessage(err: unknown, fallback = "Something went wrong"): Promise<string> {
  if (err instanceof HTTPError) {
    try {
      const body = (await err.response.clone().json()) as {
        error?: { message?: string; code?: string };
      };
      if (body?.error?.message) return body.error.message;
      if (body?.error?.code) return body.error.code;
    } catch {
      // Body wasn't JSON — fall through to status text.
    }
    return `${err.response.status} ${err.response.statusText || fallback}`;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

/**
 * Wraps an async action with toast-based error reporting. Use this instead
 * of try/catch with empty catch blocks. Returns the result on success or
 * undefined on failure (after showing a toast).
 */
export async function runWithToast<T>(
  fn: () => Promise<T>,
  options: {
    onError?: (msg: string) => void;
    successMessage?: string;
    onSuccess?: (msg: string) => void;
  } = {}
): Promise<T | undefined> {
  try {
    const result = await fn();
    if (options.successMessage && options.onSuccess) {
      options.onSuccess(options.successMessage);
    }
    return result;
  } catch (err) {
    const msg = await extractErrorMessage(err);
    if (options.onError) {
      options.onError(msg);
    }
    return undefined;
  }
}
