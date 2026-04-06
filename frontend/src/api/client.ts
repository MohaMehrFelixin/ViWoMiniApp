import ky from "ky";
import { API_BASE } from "../lib/constants";

/**
 * In production (inside Telegram), initData comes from the WebApp SDK.
 * Dev-only code for local testing is gated behind import.meta.env.DEV
 * and tree-shaken out in production builds.
 */

function isInsideTelegram(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData);
}

async function getInitData(): Promise<string> {
  // Inside Telegram: use real initData
  if (isInsideTelegram()) {
    return window.Telegram!.WebApp!.initData;
  }

  // Development only: generate signed initData for local testing
  if (import.meta.env.DEV) {
    const devInitData = await generateDevInitData();
    return devInitData;
  }

  throw new Error("This app must be opened inside Telegram");
}

// --- Dev-only helpers (tree-shaken in production builds) ---

let cachedDevInitData: string | null = null;
let cachedDevInitDataTime = 0;

async function generateDevInitData(): Promise<string> {
  const now = Date.now();
  if (cachedDevInitData && now - cachedDevInitDataTime < 600_000) {
    return cachedDevInitData;
  }

  const DEV_BOT_TOKEN = import.meta.env.VITE_BOT_TOKEN || "";
  const DEV_USER_ID = Number(import.meta.env.VITE_DEV_USER_ID) || 123456789;

  if (!DEV_BOT_TOKEN) {
    throw new Error("VITE_BOT_TOKEN env var is required for dev mode");
  }

  const authDate = Math.floor(Date.now() / 1000);
  const user = JSON.stringify({
    id: DEV_USER_ID,
    first_name: "Dev",
    last_name: "User",
    language_code: "fa",
  });

  const params: Record<string, string> = {
    auth_date: String(authDate),
    user: user,
    query_id: "dev_query",
  };

  const sortedKeys = Object.keys(params).sort();
  const dataCheckString = sortedKeys
    .map((k) => `${k}=${params[k]}`)
    .join("\n");

  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    DEV_BOT_TOKEN
  );
  const hashBuf = await hmacSha256(secretKey, dataCheckString);
  const hash = bufToHex(hashBuf);

  const allParams = new URLSearchParams({ ...params, hash });
  cachedDevInitData = allParams.toString();
  cachedDevInitDataTime = now;
  return cachedDevInitData;
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Exported API client ---

export const api = ky.create({
  prefixUrl: API_BASE,
  timeout: 15000,
  hooks: {
    beforeRequest: [
      async (request) => {
        const initData = await getInitData();
        if (initData) {
          request.headers.set("Authorization", `tma ${initData}`);
        }
      },
    ],
  },
});

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: Record<string, unknown>;
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: string) => void;
          notificationOccurred: (type: string) => void;
          selectionChanged: () => void;
        };
        themeParams: Record<string, string>;
        colorScheme: "light" | "dark";
      };
    };
  }
}
