import ky from "ky";
import { useAuthStore } from "../store/useAuthStore";

const BASE = "/api/v1/admin";

function getToken(): string | null {
  return sessionStorage.getItem("admin_token");
}

// 401 redirect target: in dev the admin lives at /admin/login, in prod it's
// the root /login of viwoapp.org. Vite injects BASE_URL so this is automatic.
const loginPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/login`;

export const api = ky.create({
  prefix: BASE,
  timeout: 15000,
  hooks: {
    beforeRequest: [
      (state) => {
        const token = getToken();
        if (token) {
          state.request.headers.set("Authorization", `Session ${token}`);
        }
      },
    ],
    afterResponse: [
      (state) => {
        if (state.response.status === 401 && getToken()) {
          // Clear both Zustand and sessionStorage
          useAuthStore.getState().logout();
          window.location.href = loginPath;
        }
      },
    ],
  },
});
