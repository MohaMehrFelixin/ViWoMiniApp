import { BrowserRouter } from "react-router-dom";
import { useKycStore } from "../store/useKycStore";
import { KycFlow } from "../pages/KycFlow";
import { AppRouter } from "./router";
import { Layout } from "../components/Layout";

export default function App() {
  const kycCompleted = useKycStore((s) => s.completed);

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
