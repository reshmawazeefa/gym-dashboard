import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary.jsx";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import { notifyError, setupGlobalErrorToasts, toastOptions } from "./services/toastNotifications";

setupGlobalErrorToasts();

window.addEventListener("error", (event) => {
  notifyError(event.error?.message || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  notifyError(event.reason?.message || event.reason || "Something went wrong");
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <GlobalErrorBoundary>
        <App />
        <Toaster
          position="top-center"
          gutter={10}
          containerStyle={{ top: 16, zIndex: 2147483647 }}
          toastOptions={toastOptions}
        />
      </GlobalErrorBoundary>
    </AuthProvider>
  </StrictMode>
);
