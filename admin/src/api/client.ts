import ky from "ky";
import { useAuthStore } from "../store/useAuthStore";

const BASE = "/api/v1/admin";

function getToken(): string | null {
  return sessionStorage.getItem("admin_token");
}

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
          window.location.href = "/admin/login";
        }
      },
    ],
  },
});
