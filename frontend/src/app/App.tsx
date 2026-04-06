import { BrowserRouter } from "react-router-dom";
import { useKycStore } from "../store/useKycStore";
import { KycFlow } from "../pages/KycFlow";
import { AppRouter } from "./router";
import { Layout } from "../components/Layout";

export default function App() {
  const kycCompleted = useKycStore((s) => s.completed);

  // Outside Telegram and not in dev mode — show a clear message
  if (!window.Telegram?.WebApp?.initData && !import.meta.env.DEV) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center", gap: 16 }}>
        <img src="/logo.jpg" alt="ViWo" style={{ width: 80, height: 80, borderRadius: 20 }} />
        <p style={{ fontSize: 16, color: "#888" }}>
          This app must be opened inside Telegram.
        </p>
      </div>
    );
  }

  if (!kycCompleted) {
    return <KycFlow />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <AppRouter />
      </Layout>
    </BrowserRouter>
  );
}
