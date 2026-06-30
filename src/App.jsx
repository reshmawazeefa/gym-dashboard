import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Members from "./pages/Members";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import Trainers from "./pages/Trainers";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import ModuleManager from "./pages/ModuleManager";
import PlatformGyms from "./pages/PlatformGyms";
import PlatformSaasPlans from "./pages/PlatformSaasPlans";
import PlatformSaasFeatures from "./pages/PlatformSaasFeatures";
import Profile from "./pages/Profile";
import Permissions from "./pages/Permissions";

function ProtectedPage({ moduleKey, children }) {
  return (
    <ProtectedRoute moduleKey={moduleKey}>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

function ProtectedModuleRoute() {
  const { moduleKey } = useParams();

  return (
    <ProtectedPage moduleKey={moduleKey}>
      <ModuleManager />
    </ProtectedPage>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <ProtectedPage moduleKey="dashboard">
              <Dashboard />
            </ProtectedPage>
          }
        />
        <Route
          path="/members"
          element={
            <ProtectedPage moduleKey="members">
              <Members />
            </ProtectedPage>
          }
        />
        <Route
          path="/plans"
          element={
            <ProtectedPage moduleKey="plans">
              <Plans />
            </ProtectedPage>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedPage moduleKey="payments">
              <Payments />
            </ProtectedPage>
          }
        />
        <Route
          path="/trainers"
          element={
            <ProtectedPage moduleKey="staff">
              <Trainers />
            </ProtectedPage>
          }
        />
        <Route
          path="/permissions"
          element={
            <ProtectedPage moduleKey="permissions">
              <Permissions />
            </ProtectedPage>
          }
        />
        <Route
          path="/platform/gyms"
          element={
            <ProtectedPage moduleKey="gyms">
              <PlatformGyms />
            </ProtectedPage>
          }
        />
        <Route
          path="/platform/saas-plans"
          element={
            <ProtectedPage moduleKey="saas-plans">
              <PlatformSaasPlans />
            </ProtectedPage>
          }
        />
        <Route
          path="/platform/saas-features"
          element={
            <ProtectedPage moduleKey="saas-features">
              <PlatformSaasFeatures />
            </ProtectedPage>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedPage moduleKey="dashboard">
              <Profile />
            </ProtectedPage>
          }
        />
        <Route path="/modules/:moduleKey" element={<ProtectedModuleRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
