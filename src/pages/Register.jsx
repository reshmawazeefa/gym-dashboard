import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getApiError, getGymId } from "../services/api";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gymId, setGymId] = useState(getGymId());
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!name || !email || !password || !gymId) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      setLoading(true);
      await register({ name, email, password, gymId });
      toast.success("Registration successful");
      navigate("/login");
    } catch (error) {
      toast.error(getApiError(error, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm rounded bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold">Register Member</h2>

        <input
          type="text"
          placeholder="Name"
          className="mb-3 w-full rounded border p-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="email"
          placeholder="Email"
          className="mb-3 w-full rounded border p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="text"
          placeholder="Gym ID"
          className="mb-3 w-full rounded border p-2"
          value={gymId}
          onChange={(e) => setGymId(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-4 w-full rounded border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full rounded bg-green-500 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Registering..." : "Register"}
        </button>

        <p className="mt-3 text-center text-sm">
          Already have an account?{" "}
          <span
            className="cursor-pointer text-blue-500"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}
