import { HTTPError } from "ky";
import type { ApiError } from "./types";

/**
 * Extracts a user-facing error message from a ky HTTPError or generic error.
 * Reads the backend's structured { error: { message } } body when available.
 */
export async function extractErrorMessage(
  err: unknown,
  fallback: string
): Promise<string> {
  if (err instanceof HTTPError) {
    try {
      const body: ApiError = await err.response.clone().json();
      if (body?.error?.message) {
        return body.error.message;
      }
    } catch {
      // response body not JSON or already consumed
    }
    return err.response.statusText || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
