import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { CategoryDetailPage } from "../pages/CategoryDetailPage";
import { QRDisplayPage } from "../pages/QRDisplayPage";
import { HouseholdPage } from "../pages/HouseholdPage";
import { HistoryPage } from "../pages/HistoryPage";
import { MapPage } from "../pages/MapPage";
import { ScannerPage } from "../pages/ScannerPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/category/:category" element={<CategoryDetailPage />} />
      <Route path="/qr" element={<QRDisplayPage />} />
      <Route path="/household" element={<HouseholdPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/scanner" element={<ScannerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
