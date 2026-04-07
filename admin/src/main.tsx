import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
// Import side-effect-only: configures i18next, applies <html dir/lang>,
// loads the persisted language (defaults to fa). Must run before App.
import "./i18n";
import { App } from "./app/App";

// import.meta.env.BASE_URL is set by Vite from vite.config.ts `base`.
//   - dev:  "/admin/"  → router basename "/admin"
//   - prod: "/"        → router basename "" (root)
// React Router 6 expects no trailing slash on basename.
const baseName = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={baseName}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
