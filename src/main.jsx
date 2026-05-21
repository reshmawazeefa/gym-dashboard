import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Toaster } from "react-hot-toast"; // ✅ add this
import { AuthProvider } from "./context/AuthContext";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Toaster position="top-right" />
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);