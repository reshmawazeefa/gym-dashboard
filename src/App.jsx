import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Members from "./pages/Members";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import PlatformLogin from "./pages/PlatformLogin";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import PlatformForgotPassword from "./pages/PlatformForgotPassword";
import VerifyOtp from "./pages/VerifyOtp";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Trainers from "./pages/Trainers";
import Payments from "./pages/PaymentsHistory";
import ModuleManager from "./pages/ModuleManager";
import PlatformGyms from "./pages/PlatformGyms";
import PlatformSaasPlans from "./pages/PlatformSaasPlans";
import Profile from "./pages/Profile";
import Permissions from "./pages/Permissions";
import Membership from "./pages/Membership";

function ProtectedPage({ moduleKey, children }) {
  return (
    <ProtectedRoute moduleKey={moduleKey}>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

function ProtectedModuleRoute() {
  const { moduleKey } = useParams();

  if (moduleKey === "subscriptions") {
    return (
      <ProtectedPage moduleKey="">
        <Membership />
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage moduleKey={moduleKey}>
      <ModuleManager />
    </ProtectedPage>
  );
}

function RoleDashboard({ role }) {
  return (
    <RoleRoute allowedRoles={[role]}>
      <ProtectedPage moduleKey="dashboard">
        <Dashboard />
      </ProtectedPage>
    </RoleRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/platform/forgot-password" element={<PlatformForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/owner" element={<RoleDashboard role="owner" />} />
        <Route path="/admin" element={<RoleDashboard role="admin" />} />
        <Route path="/trainer" element={<RoleDashboard role="trainer" />} />
        <Route path="/receptionist" element={<RoleDashboard role="receptionist" />} />
        <Route path="/staff" element={<RoleDashboard role="staff" />} />
        <Route path="/member" element={<RoleDashboard role="member" />} />

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
            <ProtectedPage moduleKey="">
              <Membership />
            </ProtectedPage>
          }
        />
        <Route
          path="/membership"
          element={
            <ProtectedPage moduleKey="">
              <Membership />
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
