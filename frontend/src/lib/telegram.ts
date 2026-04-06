/**
 * Telegram Mini App API utilities.
 * Wraps all WebApp APIs with type-safe, promise-based helpers.
 */

const tg = () => window.Telegram?.WebApp;

/** Check if a minimum Bot API version is supported */
export function canUse(version: string): boolean {
  return tg()?.isVersionAtLeast?.(version) ?? false;
}

/** Check if running inside Telegram */
export function isInsideTelegram(): boolean {
  return Boolean(tg()?.initData);
}

/** Get parsed user data from initData */
export function getTelegramUser() {
  const unsafe = tg()?.initDataUnsafe as Record<string, unknown> | undefined;
  const user = unsafe?.user as Record<string, unknown> | undefined;
  if (!user) return null;
  return {
    id: user.id as number,
    firstName: (user.first_name as string) || "",
    lastName: (user.last_name as string) || "",
    username: (user.username as string) || "",
    languageCode: (user.language_code as string) || "",
    isPremium: Boolean(user.is_premium),
    photoUrl: (user.photo_url as string) || "",
  };
}

// ─── MainButton ──────────────────────────────────────────

export function showMainButton(
  text: string,
  onClick: () => void,
  options?: { color?: string; textColor?: string; showProgress?: boolean }
) {
  const btn = tg()?.MainButton;
  if (!btn) return;
  btn.setText(text);
  if (options?.color) btn.color = options.color;
  if (options?.textColor) btn.textColor = options.textColor;
  btn.onClick(onClick);
  if (options?.showProgress) btn.showProgress(false);
  btn.show();
}

export function hideMainButton() {
  const btn = tg()?.MainButton;
  if (!btn) return;
  btn.hideProgress();
  btn.hide();
}

export function mainButtonProgress(show: boolean) {
  const btn = tg()?.MainButton;
  if (!btn) return;
  if (show) btn.showProgress(false);
  else btn.hideProgress();
}

// ─── SecondaryButton ─────────────────────────────────────

export function showSecondaryButton(text: string, onClick: () => void) {
  if (!canUse("7.10")) return;
  const btn = tg()?.SecondaryButton;
  if (!btn) return;
  btn.setText(text);
  btn.onClick(onClick);
  btn.show();
}

export function hideSecondaryButton() {
  const btn = tg()?.SecondaryButton;
  btn?.hide();
}

// ─── SettingsButton ──────────────────────────────────────

export function showSettingsButton(onClick: () => void) {
  if (!canUse("7.0")) return;
  const btn = tg()?.SettingsButton;
  if (!btn) return;
  btn.onClick(onClick);
  btn.show();
}

export function hideSettingsButton() {
  const btn = tg()?.SettingsButton;
  btn?.hide();
}

// ─── Popups ──────────────────────────────────────────────

export function nativeAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    if (canUse("6.2")) {
      tg()!.showAlert(message, () => resolve());
    } else {
      alert(message);
      resolve();
    }
  });
}

export function nativeConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (canUse("6.2")) {
      tg()!.showConfirm(message, (ok) => resolve(ok));
    } else {
      resolve(confirm(message));
    }
  });
}

export function nativePopup(params: {
  title?: string;
  message: string;
  buttons?: Array<{ id?: string; type?: string; text?: string }>;
}): Promise<string> {
  return new Promise((resolve) => {
    if (canUse("6.2")) {
      tg()!.showPopup(params, (id) => resolve(id ?? ""));
    } else {
      alert(params.message);
      resolve("");
    }
  });
}

// ─── QR Scanner ──────────────────────────────────────────

export function scanQR(text?: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!canUse("6.4")) {
      resolve(null); // Caller should use fallback
      return;
    }
    tg()!.showScanQrPopup({ text }, (data) => {
      tg()!.closeScanQrPopup();
      resolve(data || null);
      return true; // close popup after first scan
    });
  });
}

// ─── Location ────────────────────────────────────────────

export function getLocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!canUse("8.0")) {
      // Fallback to browser geolocation
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000 }
      );
      return;
    }
    const lm = tg()!.LocationManager;
    lm.init(() => {
      if (!lm.isLocationAvailable) { resolve(null); return; }
      lm.getLocation((loc) => {
        if (loc) resolve({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy ?? 0 });
        else resolve(null);
      });
    });
  });
}

// ─── Contact ─────────────────────────────────────────────

export function getContact(): Promise<{ phone: string; firstName: string; lastName: string } | null> {
  return new Promise((resolve) => {
    if (!canUse("6.9")) { resolve(null); return; }
    tg()!.requestContact((ok, event) => {
      if (ok && event?.responseUnsafe?.contact) {
        const c = event.responseUnsafe.contact;
        resolve({
          phone: c.phone_number || "",
          firstName: c.first_name || "",
          lastName: c.last_name || "",
        });
      } else {
        resolve(null);
      }
    });
  });
}

// ─── Cloud Storage ───────────────────────────────────────

export function cloudGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!canUse("6.9")) { resolve(null); return; }
    tg()!.CloudStorage.getItem(key, (err, val) => {
      resolve(err ? null : val ?? null);
    });
  });
}

export function cloudSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    if (!canUse("6.9")) { resolve(); return; }
    tg()!.CloudStorage.setItem(key, value, () => resolve());
  });
}

export function cloudRemove(key: string): Promise<void> {
  return new Promise((resolve) => {
    if (!canUse("6.9")) { resolve(); return; }
    tg()!.CloudStorage.removeItem(key, () => resolve());
  });
}

// ─── Home Screen ─────────────────────────────────────────

export function promptAddToHomeScreen() {
  if (!canUse("8.0")) return;
  tg()?.checkHomeScreenStatus?.((status) => {
    if (status === "unsupported" || status === "added") return;
    tg()?.addToHomeScreen?.();
  });
}

// ─── Write Access (Bot Notifications) ────────────────────

export function requestNotifications(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!canUse("6.9")) { resolve(false); return; }
    tg()!.requestWriteAccess((ok) => resolve(ok));
  });
}

// ─── Biometrics ──────────────────────────────────────────

export function authenticateBiometric(reason: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!canUse("7.2")) { resolve(true); return; } // Skip on old versions
    const bm = tg()!.BiometricManager;
    bm.init(() => {
      if (!bm.isBiometricAvailable) { resolve(true); return; } // Skip if no hardware
      if (!bm.isAccessGranted) {
        bm.requestAccess({ reason }, (ok) => {
          if (!ok) { resolve(true); return; } // User denied, allow anyway
          bm.authenticate({ reason }, (ok) => resolve(ok));
        });
      } else {
        bm.authenticate({ reason }, (ok) => resolve(ok));
      }
    });
  });
}

// ─── Downloads & Sharing ─────────────────────────────────

export function downloadFile(url: string, fileName: string) {
  if (canUse("8.0")) {
    tg()?.downloadFile?.({ url, file_name: fileName });
  } else {
    window.open(url, "_blank");
  }
}

export function shareStory(mediaUrl: string, text?: string) {
  if (!canUse("7.8")) return;
  tg()?.shareToStory?.(mediaUrl, { text });
}

export function openBot(path?: string) {
  const url = path ? `https://t.me/ViWoMiniBot/${path}` : "https://t.me/ViWoMiniBot";
  tg()?.openTelegramLink?.(url);
}

export function openExternalLink(url: string) {
  tg()?.openLink?.(url, { try_instant_view: true });
}

// ─── Clipboard ───────────────────────────────────────────

export function readClipboard(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!canUse("6.4")) { resolve(null); return; }
    tg()!.readTextFromClipboard((text) => resolve(text ?? null));
  });
}

// ─── Fullscreen & Orientation ────────────────────────────

export function requestFullscreen() {
  if (canUse("8.0")) tg()?.requestFullscreen?.();
}

export function exitFullscreen() {
  if (canUse("8.0")) tg()?.exitFullscreen?.();
}

export function lockPortrait() {
  if (canUse("8.0")) tg()?.lockOrientation?.();
}

export function unlockOrientation() {
  if (canUse("8.0")) tg()?.unlockOrientation?.();
}

// ─── Closing & Swipes ────────────────────────────────────

export function enableClosingConfirmation() {
  tg()?.enableClosingConfirmation?.();
}

export function disableClosingConfirmation() {
  tg()?.disableClosingConfirmation?.();
}

export function disableVerticalSwipes() {
  if (canUse("7.7")) tg()?.disableVerticalSwipes?.();
}

// ─── Theme ───────────────────────────────────────────────

export function applyThemeParams() {
  const params = tg()?.themeParams;
  if (!params) return;
  const root = document.documentElement;
  const map: Record<string, string> = {
    bg_color: "--tg-theme-bg-color",
    text_color: "--tg-theme-text-color",
    hint_color: "--tg-theme-hint-color",
    link_color: "--tg-theme-link-color",
    button_color: "--tg-theme-button-color",
    button_text_color: "--tg-theme-button-text-color",
    secondary_bg_color: "--tg-theme-secondary-bg-color",
    header_bg_color: "--tg-theme-header-bg-color",
    bottom_bar_bg_color: "--tg-theme-bottom-bar-bg-color",
    accent_text_color: "--tg-theme-accent-text-color",
    section_bg_color: "--tg-theme-section-bg-color",
    section_header_text_color: "--tg-theme-section-header-text-color",
    section_separator_color: "--tg-theme-section-separator-color",
    subtitle_text_color: "--tg-theme-subtitle-text-color",
    destructive_text_color: "--tg-theme-destructive-text-color",
  };
  for (const [key, cssVar] of Object.entries(map)) {
    const val = params[key];
    if (val) root.style.setProperty(cssVar, val);
  }
}

// ─── Payments ────────────────────────────────────────────

export function openInvoice(url: string): Promise<"paid" | "cancelled" | "failed" | "pending"> {
  return new Promise((resolve) => {
    if (!canUse("6.1")) { resolve("failed"); return; }
    tg()!.openInvoice(url, (status) => resolve(status as "paid" | "cancelled" | "failed" | "pending"));
  });
}

// ─── Inline Query ────────────────────────────────────────

export function switchInlineQuery(query: string, chatTypes?: string[]) {
  if (!canUse("6.7")) return;
  tg()?.switchInlineQuery?.(query, chatTypes);
}

// ─── Emoji Status ────────────────────────────────────────

export function setEmojiStatus(customEmojiId: string, durationSec?: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!canUse("8.0")) { resolve(false); return; }
    tg()!.setEmojiStatus(customEmojiId, { duration: durationSec }, (ok) => resolve(ok));
  });
}

// ─── Keyboard ────────────────────────────────────────────

export function hideKeyboard() {
  if (canUse("9.1")) {
    const app = tg() as Record<string, unknown> | undefined;
    if (app && typeof app.hideKeyboard === "function") app.hideKeyboard();
  }
}
