import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getApiError } from "../services/api";
import { getPortalHomePath } from "../utils/rbac";
import { resolveGymLogoUrl } from "../utils/gymLogo";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, Zap } from "lucide-react";

export default function Login({ platformOnly = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [gymOptions, setGymOptions] = useState([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (selectedGymId = "") => {
    if (!email || !password) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const session = await login({ email, password, gymId: selectedGymId || undefined, loginType: platformOnly ? "platform" : undefined });

      if (session?.ambiguous) {
        setGymOptions(session.gyms || []);
        return;
      }

      if (!session) {
        const message = "Login response did not include a valid authentication token.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      toast.success("Login successful");
      const destination = getPortalHomePath(session);
      if (!destination) {
        const message = "Your account does not have a valid portal role assigned.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      navigate(destination, { replace: true });
    } catch (error) {
      const message = getApiError(error, "Unable to sign in. Please check your credentials and try again.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-center text-2xl sm:text-[1.4rem] font-semibold text-slate-900 tracking-tight">
            {platformOnly ? "Platform Admin Login" : "Login"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 font-normal leading-relaxed text-center">
            {platformOnly ? "Manage your GymMaster platform." : "Sign in to continue to your gym dashboard."}
          </p>

          <form className="mt-6" onSubmit={(event) => { event.preventDefault(); handleLogin(); }}>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5" htmlFor="email">Email Address</label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input id="email" type="email" value={email} placeholder="email@example.com" className="block w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-brand focus:border-emerald-brand transition-colors"onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
              <button type="button" className="rounded-lg text-xs sm:text-xs  text-emerald-600 hover:text-emerald-700 hover:underline transition-colors ml-0.5" onClick={() => navigate(platformOnly ? "/platform/forgot-password" : "/forgot-password")}>Forgot password?</button>
            </div>
            <div className="relative mt-1.5">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input id="password" type={showPassword ? "text" : "password"} value={password} placeholder="Password" className="block w-full pl-10 pr-10 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-brand focus:border-emerald-brand transition-colors" onChange={(e) => setPassword(e.target.value)} />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} className="rounded-lg absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>

            <button type="submit" disabled={loading} className="mt-5 gap-3 w-full inline-flex items-center justify-center py-3 px-4 bg-[#0D8252] hover:bg-[#0B6E45] active:scale-[0.99] text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-900/20 hover:shadow-lg transition-all duration-150 cursor-pointer">
              {loading ? "Logging in..." : "Login"}
              {!loading && <ArrowRight size={13} />}
            </button>
            {errorMessage && <p role="alert" className="mt-3 text-center text-xs font-medium text-red-600">{errorMessage}</p>}
          </form>

          {gymOptions.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <h2 className="text-sm font-bold text-slate-800">Select your gym</h2>
              <div className="mt-3 space-y-2">
                {gymOptions.map((gym) => (
                  <button
                    key={gym.gymId || gym.id}
                    type="button"
                    disabled={loading}
                    onClick={() => handleLogin(gym.gymId || gym.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {resolveGymLogoUrl(gym.logo) ? <img src={resolveGymLogoUrl(gym.logo)} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Zap size={16} /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{gym.gymName || gym.name || "Gym"}</span>
                      <span className="block truncate text-xs text-slate-500">{gym.slug || ""} {gym.roles?.length ? `· ${gym.roles.join(", ")}` : ""}</span>
                    </span>
                    <ArrowRight size={15} className="text-emerald-700" />
                  </button>
                ))}
              </div>
            </div>
          )}

        {!platformOnly && (
  <>
    <p className="mt-5 text-center text-xs text-slate-500 font-normal">
      Are you a Business Owner?{" "}
      <button
        type="button"
        className="rounded-lg cursor-pointer text-emerald-600 hover:text-emerald-700 hover:underline transition-colors ml-0.5"
        onClick={() => navigate("/register")}
      >
        Register Your Business Today!
      </button>
    </p>

    <p className="text-slate-400 mt-1 text-center" style={{ fontSize: "11px", lineHeight: "15px", opacity: 0.6 }}>
      Only verified business owners are eligible to register their businesses.
    </p>
  </>
)}
          {platformOnly && (
            <p className="mt-5 text-xs text-slate-500 font-normal text-center">
              Gym staff login? <button type="button" className="rounded-lg font-bold text-emerald-700 hover:text-emerald-800" onClick={() => navigate("/login")}>Use gym login</button>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
