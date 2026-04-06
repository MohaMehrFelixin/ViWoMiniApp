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

interface TgButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  hasShineEffect: boolean;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  setText: (text: string) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  showProgress: (leaveActive: boolean) => void;
  hideProgress: () => void;
  setParams: (params: Record<string, unknown>) => void;
}

interface TgSmallButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

interface TgBiometricManager {
  isInited: boolean;
  isBiometricAvailable: boolean;
  biometricType: string;
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  isBiometricTokenSaved: boolean;
  deviceId: string;
  init: (cb?: () => void) => void;
  requestAccess: (params: { reason: string }, cb?: (ok: boolean) => void) => void;
  authenticate: (params: { reason: string }, cb?: (ok: boolean, token?: string) => void) => void;
  updateBiometricToken: (token: string, cb?: (ok: boolean) => void) => void;
  openSettings: () => void;
}

interface TgLocationManager {
  isInited: boolean;
  isLocationAvailable: boolean;
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  init: (cb?: () => void) => void;
  getLocation: (cb: (loc: { latitude: number; longitude: number; altitude?: number; course?: number; speed?: number; horizontal_accuracy?: number; vertical_accuracy?: number; accuracy?: number } | null) => void) => void;
  openSettings: () => void;
}

interface TgCloudStorage {
  setItem: (key: string, value: string, cb?: (err: string | null) => void) => void;
  getItem: (key: string, cb: (err: string | null, val?: string) => void) => void;
  getItems: (keys: string[], cb: (err: string | null, vals?: Record<string, string>) => void) => void;
  removeItem: (key: string, cb?: (err: string | null) => void) => void;
  removeItems: (keys: string[], cb?: (err: string | null) => void) => void;
  getKeys: (cb: (err: string | null, keys?: string[]) => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        // Core
        initData: string;
        initDataUnsafe: Record<string, unknown>;
        version: string;
        platform: string;
        isExpanded: boolean;
        isActive: boolean;
        isFullscreen: boolean;
        isOrientationLocked: boolean;
        isClosingConfirmationEnabled: boolean;
        isVerticalSwipesEnabled: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        safeAreaInset: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset: { top: number; bottom: number; left: number; right: number };
        headerColor: string;
        backgroundColor: string;
        bottomBarColor: string;
        colorScheme: "light" | "dark";
        themeParams: Record<string, string>;

        // Lifecycle
        ready: () => void;
        expand: () => void;
        close: () => void;
        isVersionAtLeast: (version: string) => boolean;

        // Buttons
        MainButton: TgButton;
        SecondaryButton: TgButton;
        BackButton: TgSmallButton;
        SettingsButton: TgSmallButton;

        // Haptic
        HapticFeedback: {
          impactOccurred: (style: string) => void;
          notificationOccurred: (type: string) => void;
          selectionChanged: () => void;
        };

        // Popups
        showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, cb?: (id: string) => void) => void;
        showAlert: (message: string, cb?: () => void) => void;
        showConfirm: (message: string, cb?: (ok: boolean) => void) => void;
        showScanQrPopup: (params: { text?: string }, cb?: (data: string) => boolean | void) => void;
        closeScanQrPopup: () => void;

        // Theme
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        setBottomBarColor: (color: string) => void;

        // Storage
        CloudStorage: TgCloudStorage;

        // Biometrics & Location
        BiometricManager: TgBiometricManager;
        LocationManager: TgLocationManager;

        // User permissions
        requestContact: (cb: (ok: boolean, event?: { responseUnsafe?: { contact?: { phone_number?: string; first_name?: string; last_name?: string } } }) => void) => void;
        requestWriteAccess: (cb: (ok: boolean) => void) => void;

        // Links
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string, cb?: (status: string) => void) => void;

        // Data
        sendData: (data: string) => void;
        switchInlineQuery: (query: string, chatTypes?: string[]) => void;
        readTextFromClipboard: (cb: (text: string | null) => void) => void;

        // Fullscreen & Orientation
        requestFullscreen: () => void;
        exitFullscreen: () => void;
        lockOrientation: () => void;
        unlockOrientation: () => void;

        // Home Screen
        addToHomeScreen: () => void;
        checkHomeScreenStatus: (cb: (status: string) => void) => void;

        // Closing & Swipes
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        enableVerticalSwipes: () => void;
        disableVerticalSwipes: () => void;

        // Sharing & Files
        shareToStory: (mediaUrl: string, params?: { text?: string; widget_link?: { url: string; name?: string } }) => void;
        downloadFile: (params: { url: string; file_name: string }, cb?: () => void) => void;
        shareMessage: (msgId: string, cb?: (ok: boolean) => void) => void;

        // Emoji Status
        requestEmojiStatusAccess: (cb: (ok: boolean) => void) => void;
        setEmojiStatus: (customEmojiId: string, params?: { duration?: number }, cb?: (ok: boolean) => void) => void;

        // Events
        onEvent: (event: string, cb: (...args: unknown[]) => void) => void;
        offEvent: (event: string, cb: (...args: unknown[]) => void) => void;
      };
    };
  }
}
