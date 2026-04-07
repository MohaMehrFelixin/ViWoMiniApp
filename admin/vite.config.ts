import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Base path differs between dev and prod:
//   - dev: served at http://localhost:3001/admin/ alongside the main Mini App
//   - prod: served as the entire viwoapp.org domain, so base is "/"
//
// React Router picks this up automatically via import.meta.env.BASE_URL
// (set in main.tsx).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: mode === "production" ? "/" : "/admin/",
  server: { port: 3001, proxy: { "/api": "http://localhost:8090" } },
}));
