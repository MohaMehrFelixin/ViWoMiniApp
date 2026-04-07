import { create } from "zustand";
import type { AdminUser } from "../lib/types";

function safeParseAdmin(): AdminUser | null {
  try {
    const raw = sessionStorage.getItem("admin_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    sessionStorage.removeItem("admin_user");
    return null;
  }
}

interface AuthState {
  token: string | null;
  admin: AdminUser | null;
  login: (token: string, admin: AdminUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: sessionStorage.getItem("admin_token"),
  admin: safeParseAdmin(),

  login: (token, admin) => {
    sessionStorage.setItem("admin_token", token);
    sessionStorage.setItem("admin_user", JSON.stringify(admin));
    set({ token, admin });
  },

  logout: () => {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_user");
    set({ token: null, admin: null });
  },

  isAuthenticated: () => get().token !== null && get().admin !== null,
}));
