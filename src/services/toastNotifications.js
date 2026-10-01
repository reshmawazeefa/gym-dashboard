import toast from "react-hot-toast";

const RECENT_ERROR_WINDOW = 4500;
const recentErrors = new Map();
let originalToastError = null;
let isConfigured = false;

function normalizeMessage(message, fallback = "Something went wrong") {
  if (message instanceof Error) return message.message || fallback;
  if (Array.isArray(message)) return message.filter(Boolean).join("\n") || fallback;
  if (message && typeof message === "object") {
    return message.message || message.error || fallback;
  }
  return String(message || fallback).trim() || fallback;
}

function getToastId(message) {
  return `error:${normalizeMessage(message).toLowerCase()}`;
}

function clearRecentError(id) {
  const timeoutId = recentErrors.get(id);
  if (timeoutId) window.clearTimeout(timeoutId);
  recentErrors.delete(id);
}

export function notifyError(message, options = {}) {
  const normalizedMessage = normalizeMessage(message);
  const id = options.id || getToastId(normalizedMessage);

  if (recentErrors.has(id)) return id;

  const timeoutId = window.setTimeout(() => clearRecentError(id), RECENT_ERROR_WINDOW);
  recentErrors.set(id, timeoutId);

  return (originalToastError || toast.error)(normalizedMessage, {
    ...options,
    id,
  });
}

export function setupGlobalErrorToasts() {
  if (isConfigured) return;
  isConfigured = true;
  originalToastError = toast.error.bind(toast);
  toast.error = notifyError;
}

export const toastOptions = {
  duration: 4200,
  style: {
    maxWidth: "min(92vw, 460px)",
    borderRadius: "14px",
    border: "1px solid #fecaca",
    background: "#fff7f7",
    color: "#991b1b",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.16)",
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.45,
    padding: "12px 14px",
    zIndex: 2147483647,
  },
  success: {
    style: {
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    },
  },
  error: {
    duration: 4200,
  },
};
