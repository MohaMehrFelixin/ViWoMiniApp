import { BrowserRouter } from "react-router-dom";
import { useKycStore } from "../store/useKycStore";
import { KycFlow } from "../pages/KycFlow";
import { AppRouter } from "./router";
import { Layout } from "../components/Layout";

export default function App() {
  const kycCompleted = useKycStore((s) => s.completed);

  // Outside Telegram and not in dev mode — redirect to the bot
  if (!window.Telegram?.WebApp?.initData && !import.meta.env.DEV) {
    window.location.href = "https://t.me/ViWoMiniBot";
    return null;
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
