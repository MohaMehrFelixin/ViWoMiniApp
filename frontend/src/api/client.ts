import ky from "ky";
import { API_BASE } from "../lib/constants";

/**
 * In production (inside Telegram), initData comes from the WebApp SDK.
 * In development (browser), we generate a valid initData signed with the bot token
 * so the backend's HMAC-SHA256 validation passes.
 */

const DEV_BOT_TOKEN = "8693627825:AAFtaFlq4c6Lv2loqooHPphjB_Y8U6PyqqU";
const DEV_USER_ID = 123456789;

function isInsideTelegram(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData);
}

/** HMAC-SHA256 using Web Crypto API */
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

/** Generate a valid initData string for dev mode */
async function generateDevInitData(): Promise<string> {
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

  // Build data-check-string: sort keys, join as "key=value\n"
  const sortedKeys = Object.keys(params).sort();
  const dataCheckString = sortedKeys
    .map((k) => `${k}=${params[k]}`)
    .join("\n");

  // HMAC-SHA256("WebAppData", bot_token) -> secret_key
  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    DEV_BOT_TOKEN
  );

  // HMAC-SHA256(secret_key, data_check_string) -> hash
  const hashBuf = await hmacSha256(secretKey, dataCheckString);
  const hash = bufToHex(hashBuf);

  // Build URL-encoded initData
  const allParams = new URLSearchParams({ ...params, hash });
  return allParams.toString();
}

// Cache the dev initData so we don't regenerate every request
let cachedDevInitData: string | null = null;
let cachedDevInitDataTime = 0;

async function getInitData(): Promise<string> {
  // Inside Telegram: use real initData
  if (isInsideTelegram()) {
    return window.Telegram!.WebApp!.initData;
  }

  // Dev mode: generate valid signed initData
  const now = Date.now();
  // Regenerate every 10 minutes (backend checks 24h window, but keep it fresh)
  if (!cachedDevInitData || now - cachedDevInitDataTime > 600_000) {
    cachedDevInitData = await generateDevInitData();
    cachedDevInitDataTime = now;
  }
  return cachedDevInitData;
}

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
