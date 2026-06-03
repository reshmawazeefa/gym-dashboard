import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getApiError } from "../services/api";

const loginModes = [
  {
    id: "owner",
    label: "Gym Owner",
    email: "gym1@gmail.com",
    gymId: "504d9d9c-6c55-43be-a802-018693024a30",
  },
  {
    id: "staff",
    label: "Gym Staff",
    email: "gymadmin@wazeefa.in",
    gymId: "c695080e-3fb3-483b-9c1c-2ecb41d1ec8e",
  },
  {
    id: "member",
    label: "Gym Member",
    email: "user3@wazeefa.in",
    gymId: "c695080e-3fb3-483b-9c1c-2ecb41d1ec8e",
  },
  {
    id: "platform",
    label: "Platform Admin",
    email: "admin@wazeefa.in",
    gymId: "",
  },
];

export default function Login() {
  const [loginType, setLoginType] = useState("owner");
  const [email, setEmail] = useState("gym1@gmail.com");
  const [gymId, setGymId] = useState("504d9d9c-6c55-43be-a802-018693024a30");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const selectMode = (mode) => {
    setLoginType(mode.id);
    setEmail(mode.email);
    setGymId(mode.gymId);
    setPassword("QWERTY1029384756");
  };

  const handleLogin = async () => {
    if (!email || !password || (loginType !== "platform" && !gymId)) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);
      const session = await login({ email, password, gymId, loginType });

      if (!session) {
        toast.error("Login response did not include a token");
        return;
      }

      toast.success("Login successful");
      navigate("/");
    } catch (error) {
      toast.error(getApiError(error, "Invalid credentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 md:grid md:grid-cols-[1fr_0.9fr]">
        <div className="bg-gray-950 p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
            Gym Master
          </p>
          <h1 className="mt-3 text-3xl font-bold">Gym Management System</h1>
          <p className="mt-3 text-sm leading-6 text-gray-300">
            Sign in with a platform admin, gym owner, staff, or member account.
          </p>

          <div className="mt-8 grid gap-3">
            {loginModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => selectMode(mode)}
                className={`rounded-md border p-3 text-left transition hover:bg-white/10 ${
                  loginType === mode.id
                    ? "border-blue-300 bg-blue-500/15"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-sm font-semibold">{mode.label}</p>
                <p className="mt-1 text-xs text-gray-300">{mode.email}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-950">Login</h2>
          <p className="mt-1 text-sm text-gray-500">
            Password defaults to the API test password you shared.
          </p>

          <label className="mt-6 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            placeholder="email@example.com"
            className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            onChange={(e) => setEmail(e.target.value)}
          />

          {loginType !== "platform" && (
            <>
              <label className="mt-4 block text-sm font-medium text-gray-700">
                Gym ID
              </label>
              <input
                type="text"
                value={gymId}
                placeholder="Gym ID"
                className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(e) => setGymId(e.target.value)}
              />
            </>
          )}

          <label className="mt-4 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            placeholder="Password"
            className="mt-2 w-full rounded-md border border-gray-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-6 w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          <p className="mt-4 text-center text-sm text-gray-500">
            Need a new member account?{" "}
            <span
              className="cursor-pointer font-semibold text-blue-600"
              onClick={() => navigate("/register")}
            >
              Register
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
