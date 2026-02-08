import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    phoneNumber: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.phoneNumber || !form.password) {
      setError("All fields are required");
      return;
    }

    try {
      setLoading(true);

      const endpoint = "http://localhost:5000";
      const res = await fetch(`${endpoint}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Login failed");
      }

      // store token
      localStorage.setItem("admin_token", data.token);

      // optional: store role/context
      localStorage.setItem("role", "ADMIN");

      // redirect to admin dashboard
      navigate("/admin/dashboard");

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c]">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#121214] border border-white/10 shadow-xl">

        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-white">Admin Access</h1>
          <p className="text-sm text-gray-400 mt-1">
            Authorized personnel only
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={handleChange}
              placeholder="Enter phone number"
              className="w-full px-4 py-3 rounded-lg bg-[#0f0f11] text-white border border-white/10 focus:outline-none focus:border-white/30 transition"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter password"
              className="w-full px-4 py-3 rounded-lg bg-[#0f0f11] text-white border border-white/10 focus:outline-none focus:border-white/30 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Login"}
          </button>

        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          Secured Admin Interface
        </div>
      </div>
    </div>
  );
};

export default Auth;
