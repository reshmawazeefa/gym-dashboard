import { useLocation } from "react-router-dom";
import ForgotPassword from "./ForgotPassword";

export default function VerifyOtp() {
  const location = useLocation();
  return <ForgotPassword initialEmail={location.state?.email || ""} initialStep={2} />;
}
