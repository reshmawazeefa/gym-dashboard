import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { ChevronDown, Eye, EyeOff, KeyRound, Mail, Phone, Search, UserRound, Zap } from "lucide-react";
import { getApiError, resendGymRegistrationOtp, startGymRegistration, verifyGymRegistration } from "../services/api";
import { useAuth } from "../context/AuthContext";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function getFlag(code) {
  return code
    .toUpperCase()
    .replace(/./g, (character) => String.fromCodePoint(character.charCodeAt(0) + 127397));
}

function getCountryOptions() {
  return getCountries()
    .map((code) => ({
      value: code,
      label: regionNames.of(code) || code,
      flag: getFlag(code),
      callingCode: `+${getCountryCallingCode(code)}`,
    }))
    .sort((first, second) => first.label.localeCompare(second.label));
}

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  countryCode: "+91",
  country: "IN",
  phoneNumber: "",
  businessName: "",
  businessId: "",
  password: "",
  confirmPassword: "",
};

const passwordChecks = [
  ["length", "At least 8 characters", (value) => value.length >= 8],
  ["uppercase", "One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["lowercase", "One lowercase letter", (value) => /[a-z]/.test(value)],
  ["number", "One number", (value) => /\d/.test(value)],
  ["special", "One special character", (value) => /[^A-Za-z0-9]/.test(value)],
];

function getPasswordStrength(password) {
  const score = passwordChecks.filter(([, , test]) => test(password)).length;
  if (!password) return { label: "Weak", color: "text-slate-400", bar: "bg-slate-200", width: "w-0", score };
  if (score <= 2) return { label: "Weak", color: "text-red-600", bar: "bg-red-500", width: "w-1/3", score };
  if (score <= 4) return { label: "Medium", color: "text-amber-600", bar: "bg-amber-500", width: "w-2/3", score };
  return { label: "Strong", color: "text-emerald-700", bar: "bg-emerald-600", width: "w-full", score };
}

function validateForm(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!/^\d{7,15}$/.test(form.phoneNumber.replace(/\D/g, ""))) errors.phoneNumber = "Enter a valid phone number.";
  if (!form.country) errors.country = "Country is required.";
  if (!form.businessName.trim()) errors.businessName = "Business name is required.";
  if (!passwordChecks.every(([, , test]) => test(form.password))) errors.password = "Password does not meet all requirements.";
  if (form.password !== form.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export default function Register() {
  const navigate = useNavigate();
  const { completeOwnerRegistration } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [otp, setOtp] = useState("");
  const [resendSeconds, setResendSeconds] = useState(60);
  const otpRefs = useRef([]);
  const [registrationId, setRegistrationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const selectedPhoneCountry = countryOptions.find((option) => option.callingCode === form.countryCode) || countryOptions.find((option) => option.value === form.country) || countryOptions[0];
  const isFormValid = Object.keys(validateForm(form)).length === 0;

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

  const update = (field, value) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setErrors((current) => {
      const nextErrors = { ...current };
      const nextFieldErrors = validateForm(nextForm);
      if (nextFieldErrors[field]) nextErrors[field] = nextFieldErrors[field];
      else delete nextErrors[field];
      if (field === "password" || field === "confirmPassword") {
        if (nextFieldErrors.confirmPassword) nextErrors.confirmPassword = nextFieldErrors.confirmPassword;
        else delete nextErrors.confirmPassword;
      }
      return nextErrors;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(Object.values(nextErrors)[0]);
      return;
    }

    try {
      setLoading(true);
      const response = await startGymRegistration({
        gymName: form.businessName.trim(),
        slug: form.businessId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        ownerName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        password: form.password,
        country: form.country,
        taxId: form.businessId.trim() || undefined,
        phoneNumber1: form.phoneNumber.trim(),
      });
      const nextRegistrationId = response?.data?.registrationId || response?.registrationId || response?.data?.id || response?.id;
      if (!nextRegistrationId) throw new Error("Registration ID was not returned.");
      setRegistrationId(nextRegistrationId);
      toast.success("OTP sent to your email.");
      setStep(2);
    } catch (error) {
      const message = getApiError(error, "Unable to send verification OTP.");
      setErrors({ form: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      const message = "OTP must be a 6-digit number.";
      setErrors({ otp: message });
      toast.error(message);
      return;
    }
    try {
      setLoading(true);
      setErrors({});
      if (!registrationId) throw new Error("Registration session has expired. Please start again.");
      const response = await verifyGymRegistration({ registrationId, email: form.email.trim(), otp });
      setStep(3);
      await completeOwnerRegistration(response);
      toast.success("Business registration successful.");
      navigate("/modules/subscriptions", { replace: true });
    } catch (error) {
      setStep(2);
      const message = getApiError(error, "Invalid or expired verification OTP.");
      setErrors({ otp: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendSeconds > 0 || loading) return;
    try {
      setLoading(true);
      setErrors({});
      if (!registrationId) throw new Error("Registration session has expired. Please start again.");
      await resendGymRegistrationOtp({ registrationId, email: form.email.trim() });
      toast.success("A new OTP was sent to your email.");
      setOtp("");
      setResendSeconds(60);
      otpRefs.current[0]?.focus();
    } catch (error) {
      const message = getApiError(error, "Unable to resend verification OTP.");
      setErrors({ form: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) => `block w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-slate-50/70 border rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-brand focus:border-emerald-brand transition-colors ${errors[field] ? "border-red-400" : "border-slate-200"}`;
  const submitHandler = step === 1 ? submit : verify;

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#dff8f0_0%,#effaf7_46%,#f7fbfa_100%)] px-4 py-8">
      <div className="w-full max-w-[430px]">
        <div className="mb-5 flex items-center justify-center gap-1.5 text-slate-900">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md bg-[#0D8252] text-white"><Zap size={18} fill="currentColor" /></span>
          <span className="text-lg font-bold tracking-tight text-slate-900">GymMaster</span>
        </div>
      <section className="rounded-[18px] bg-white px-6 py-7 shadow-[0_14px_35px_rgba(27,87,71,0.10)] ring-1 ring-slate-100 sm:px-7 sm:py-8">
        <div className="text-center">
          <h1 className="text-center text-2xl sm:text-[1.4rem] font-semibold text-slate-900 tracking-tight">{step === 1 ? "Register Your Business" : step === 2 ? "Verify Your Email" : "Setting Up Your Business"}</h1>
          <p className="mt-1.5 text-sm text-slate-500 font-normal leading-relaxed text-center">{step === 1 ? "Enter your details to register your gym account." : step === 2 ? `We've sent a 6-digit one-time passcode to ${form.email} Enter it below to reset your password.` : "Your owner account and business are being created."}</p>
        </div>

        <form onSubmit={submitHandler} className="mt-5 space-y-4">
          {step === 1 && <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First Name" error={errors.firstName} icon={<UserRound size={15} />}><input id="first-name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} placeholder="e.g. John" className={`${inputClass("firstName")} pl-9`} /></Field>
              <Field label="Last Name" error={errors.lastName} icon={<UserRound size={15} />}><input id="last-name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} placeholder="e.g. Doe" className={`${inputClass("lastName")} pl-9`} /></Field>
            </div>
            <Field label="Email Address" error={errors.email} icon={<Mail size={15} />}><input id="email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="e.g. john@example.com" className={`${inputClass("email")} pl-9`} /></Field>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
              <div className="flex gap-1.5">
                <SearchableSelect
                  ariaLabel="Country calling code"
                  options={countryOptions}
                  value={selectedPhoneCountry?.value || ""}
                  onChange={(option) => update("countryCode", option.callingCode)}
                  className="w-[100px]"
                  showCallingCode
                />
                <div className="relative flex-1"><Phone className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="tel" value={form.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value.replace(/[^\d\s()-]/g, ""))} placeholder="e.g. 555–0199" className={`${inputClass("phoneNumber")} pl-10`} /></div>
              </div>
              {errors.phoneNumber && <p className="mt-1 text-xs text-red-600">{errors.phoneNumber}</p>}
            </div>
            <div className="relative">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Country</label>
              <SearchableSelect
                ariaLabel="Country"
                options={countryOptions}
                value={form.country}
                onChange={(option) => update("country", option.value)}
                error={errors.country}
              />
            </div>
            <Field label="Business / Gym Name" error={errors.businessName} icon={<UserRound size={15} />}><input id="business-name" value={form.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="e.g. Fit24 Gym" className={`${inputClass("businessName")} pl-9`} /></Field>
            <Field label="Tax ID / GST Number" error={errors.businessId} icon={<KeyRound size={15} />}><input id="business-id" value={form.businessId} onChange={(event) => update("businessId", event.target.value)} placeholder="Optional" className={`${inputClass("businessId")} pl-9`} /></Field>
            <PasswordField label="Create Password" value={form.password} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => update("password", value)} error={errors.password} inputClass={inputClass("password")} />
            <div className="-mt-2 text-[11px] text-slate-400"><div className="flex h-[0.8px] gap-1"><div className={`flex-1 rounded-full ${strength.score >= 1 ? strength.bar : "bg-slate-200"}`} /><div className={`flex-1 rounded-full ${strength.score >= 2 ? strength.bar : "bg-slate-200"}`} /><div className={`flex-1 rounded-full ${strength.score >= 3 ? strength.bar : "bg-slate-200"}`} /><div className={`flex-1 rounded-full ${strength.score >= 4 ? strength.bar : "bg-slate-200"}`} /><div className={`flex-1 rounded-full ${strength.score >= 5 ? strength.bar : "bg-slate-200"}`} /></div><p className="mt-1">Must be at least 8 characters with letters and numbers.</p></div>
            <PasswordField label="Confirm Password" value={form.confirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} onChange={(value) => update("confirmPassword", value)} error={errors.confirmPassword} inputClass={inputClass("confirmPassword")} />
          </>}
          {step === 2 && <div>
            <label className="sr-only" htmlFor="registration-otp-1">Verification Code</label>
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  key={index}
                  id={index === 0 ? "registration-otp-1" : undefined}
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
            {errors.otp && <p className="mt-2 text-center text-xs text-red-600">{errors.otp}</p>}
            <div className="mt-5 flex items-center justify-center gap-1 text-xs">
              <span className="text-slate-400">Didn't receive the code?</span>
              <button type="button" disabled={loading || resendSeconds > 0} onClick={resend} className="rounded-lg cursor-pointer font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline disabled:cursor-not-allowed">Resend code</button>
              <span className="ml-1 text-slate-400">({formattedResendTime})</span>
            </div>
          </div>}
          {step === 3 && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Email verified. Setting up your owner account and business...</div>}
          {errors.form && <p role="alert" className="text-sm font-medium text-red-600">{errors.form}</p>}
          {step !== 3 && <button type="submit" disabled={loading || (step === 1 && !isFormValid)} className="mt-5 gap-3 w-full inline-flex items-center justify-center py-3 px-4 bg-[#0D8252] hover:bg-[#0B6E45] active:scale-[0.99] text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-900/20 hover:shadow-lg transition-all duration-150 cursor-pointer disabled:opacity-60">{loading ? (step === 1 ? "Sending OTP..." : "Verifying and setting up...") : (step === 1 ? "Continue to Verify Email" : "Verify & Continue")}</button>}
        </form>
        <p className="mt-5 text-center text-xs text-slate-500 font-normal">Already have an account? <button type="button" onClick={() => navigate("/login")} className="rounded-lg cursor-pointer font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors ml-0.5">Login</button></p>
      </section>
      </div>
    </main>
  );
}

function Field({ label, error, icon, children }) {
  const fieldId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return <div><label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5" htmlFor={fieldId}>{label}</label><div className="relative">{icon && <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-400">{icon}</span>}{children}</div>{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}

function SearchableSelect({ ariaLabel, options, value, onChange, className = "", showCallingCode = false, error = "" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value) || options[0];
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.callingCode} ${option.value}`.toLowerCase().includes(search.toLowerCase())
  );

  const choose = (option) => {
    onChange(option);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-slate-50/70 px-3 py-2.5 sm:py-3 text-left text-sm text-slate-800 outline-none transition-colors hover:bg-white focus:border-emerald-brand focus:bg-white focus:ring-2 focus:ring-emerald-brand ${error ? "border-red-400" : "border-slate-200"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none">{selected?.flag}</span>
          <span className="truncate">{showCallingCode ? selected?.callingCode : selected?.label}</span>
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[245px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search country"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-700 outline-none focus:border-emerald-brand focus:bg-white focus:ring-2 focus:ring-emerald-brand"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length ? filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-emerald-50 ${option.value === value ? "bg-emerald-50 text-emerald-800" : "text-slate-700"}`}
              >
                <span className="text-base leading-none">{option.flag}</span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="shrink-0 text-slate-400">{option.callingCode}</span>
              </button>
            )) : <p className="px-3 py-4 text-center text-xs text-slate-400">No countries found</p>}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PasswordField({ label, value, visible, onToggle, onChange, error }) {
  const inputId = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div>
      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5" htmlFor={inputId}>{label}</label>
      <div className="relative">
        <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8798b5]" />
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          className={`block h-11 w-full rounded-xl border bg-[#fbfcff] pl-10 pr-10 text-sm text-slate-800 placeholder:text-[#94a3bd] outline-none transition-colors focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 ${error ? "border-red-400" : "border-[#d8e2ef]"}`}
        />
        <button type="button" aria-label={visible ? `Hide ${label}` : `Show ${label}`} onClick={onToggle} className="rounded-lg absolute right-3 top-1/2 -translate-y-1/2 text-[#8798b5] transition-colors hover:text-slate-600">
          {visible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
