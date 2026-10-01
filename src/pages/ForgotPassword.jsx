import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  forgotPassword,
  getApiError,
  platformForgotPassword,
  platformResetPassword,
  platformVerifyOtp,
  resetPassword,
  verifyOtp,
} from "../services/api";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, Zap } from "lucide-react";

export default function ForgotPassword({ platformOnly = false, initialEmail = "", initialStep = 1 }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [resendSeconds, setResendSeconds] = useState(60);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const otpRefs = useRef([]);

  useEffect(() => {
    if (step !== 2) return undefined;

    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step]);

  const formattedResendTime = `${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")}`;

  const updateOtp = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = otp.padEnd(6, " ").split("");
    nextOtp[index] = digit || " ";
    setOtp(nextOtp.join("").replace(/\s/g, ""));
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pastedOtp = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setOtp(pastedOtp);
    if (pastedOtp) otpRefs.current[Math.min(pastedOtp.length, 6) - 1]?.focus();
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const requestOtp = async (event) => {
    event?.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    try {
      setLoading(true);
      setErrorMessage("");
      if (platformOnly) await platformForgotPassword({ email: email.trim() });
      else await forgotPassword({ email: email.trim() });
      toast.success(platformOnly ? "If an account exists for this email, an OTP has been sent." : "OTP sent to your email.");
      setOtp("");
      setResendSeconds(60);
      setStep(2);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (error) {
      setErrorMessage(getApiError(error, "Unable to send OTP. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage("OTP must be a 6-digit number.");
      return;
    }
    try {
      setLoading(true);
      setErrorMessage("");
      const result = platformOnly
        ? await platformVerifyOtp({ email: email.trim(), otp })
        : await verifyOtp({ email: email.trim(), otp });
      const token = result?.data?.resetToken || result?.data?.token || result?.resetToken || result?.token;
      if (!token) throw new Error("Reset token was not received. The OTP may have expired.");
      setResetToken(token);
      setStep(3);
    } catch (error) {
      setErrorMessage(getApiError(error, "Invalid or expired OTP."));
    } finally {
      setLoading(false);
    }
  };

  const reset = async (event) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      setErrorMessage("");
      const payload = { token: resetToken, newPassword };
      if (platformOnly) await platformResetPassword(payload);
      else await resetPassword(payload);
      toast.success("Password reset successful. Please log in again.");
      navigate(platformOnly ? "/platform/login" : "/login");
    } catch (error) {
      setErrorMessage(getApiError(error, "Unable to reset password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const submit = step === 1 ? requestOtp : step === 2 ? verify : reset;
  const titles = ["Forgot Password", "Verify OTP", "Create New Password"];
  const descriptions = [
    "Enter your registered email address and gym slug. We'll send you a secure link to reset your credentials.",
    "Enter the verification code sent to your registered email address.",
    "Choose a new password to secure your account.",
  ];

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#dff8f0_0%,#effaf7_46%,#f7fbfa_100%)] px-4 py-8">
      <div className="w-full max-w-[430px]">
        <div className="mb-5 flex items-center justify-center gap-1.5 text-slate-900">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md bg-[#0D8252] text-white">
            <Zap size={18} fill="currentColor" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">GymMaster</span>
        </div>

        <section className="rounded-[18px] bg-white px-6 py-7 shadow-[0_14px_35px_rgba(27,87,71,0.10)] ring-1 ring-slate-100 sm:px-7 sm:py-8">
          <h1 className="text-center text-2xl sm:text-[1.4rem] font-semibold text-slate-900 tracking-tight">{titles[step - 1]}</h1>
          <p className="mt-1.5 text-sm text-slate-500 font-normal leading-relaxed text-center">{descriptions[step - 1]}</p>

          <form onSubmit={submit} className="mt-6" >
            {step === 1 && <><label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5" htmlFor="forgot-email">Email Address</label><div className="relative mt-1.5"><Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" className="block w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-brand focus:border-emerald-brand transition-colors" /></div></>}
            {step === 2 && <div>
              <label className="sr-only" htmlFor="forgot-otp-1">Verification Code</label>
              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    id={index === 0 ? "forgot-otp-1" : undefined}
                    ref={(element) => { otpRefs.current[index] = element; }}
                    autoFocus={index === 0}
                    inputMode="numeric"
                    maxLength={1}
                    value={otp[index] || ""}
                    onChange={(event) => updateOtp(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(event, index)}
                    aria-label={`OTP digit ${index + 1}`}
                    placeholder="-"
                    className="h-12 w-10 rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 placeholder:text-slate-500 outline-none shadow-sm transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 sm:h-14 sm:w-12"
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-center gap-1 text-xs">
                <span className="text-slate-400">Didn't receive the code?</span>
                <button type="button" disabled={loading || resendSeconds > 0} onClick={() => requestOtp()} className="rounded-lg cursor-pointer font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline disabled:cursor-not-allowed">Resend code</button>
                <span className="ml-1 text-slate-400">({formattedResendTime})</span>
              </div>
            </div>}
            {step === 3 && <div className="space-y-4">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <label className="sr-only" htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New Password"
                  className="block h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-11 text-sm font-normal text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  onClick={() => setShowNewPassword((visible) => !visible)}
                  className="rounded-lg absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showNewPassword ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <label className="sr-only" htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm Password"
                  className="block h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-11 text-sm font-normal text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  className="rounded-lg absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showConfirmPassword ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            </div>}
            {errorMessage && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{errorMessage}</p>}
            <button type="submit" disabled={loading} className="mt-5 gap-3 w-full inline-flex items-center justify-center py-3 px-4 bg-[#0D8252] hover:bg-[#0B6E45] active:scale-[0.99] text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-900/20 hover:shadow-lg transition-all duration-150 cursor-pointer disabled:opacity-60">{loading ? (step === 1 ? "Sending OTP..." : step === 2 ? "Verifying OTP..." : "Resetting password...") : (step === 1 ? "Send Reset Link" : step === 2 ? "Verify OTP" : "Reset Password")}{!loading && <ArrowRight size={13} />}</button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-5 text-center"><span className="text-xs text-slate-500 font-normal">Remembered your credentials? </span><Link to={platformOnly ? "/platform/login" : "/login"} className="cursor-pointer text-emerald-600 hover:text-emerald-700 hover:underline transition-colors ml-0.5 text-xs ">Back to Login <ArrowRight className="ml-0.5 inline" size={10} /></Link></div>
        </section>
      </div>
    </main>
  );
}
