import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { CategoryDetailPage } from "../pages/CategoryDetailPage";
import { QRDisplayPage } from "../pages/QRDisplayPage";
import { ProfilePage, ProfileInfoPage, ProfileHouseholdPage, ProfileHistoryPage, ProfileCollaborationPage } from "../pages/ProfilePage";
import { MapPage } from "../pages/MapPage";
import { ScannerPage } from "../pages/ScannerPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/category/:category" element={<CategoryDetailPage />} />
      <Route path="/qr" element={<QRDisplayPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/info" element={<ProfileInfoPage />} />
      <Route path="/profile/household" element={<ProfileHouseholdPage />} />
      <Route path="/profile/history" element={<ProfileHistoryPage />} />
      <Route path="/profile/collaboration" element={<ProfileCollaborationPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/scanner" element={<ScannerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
