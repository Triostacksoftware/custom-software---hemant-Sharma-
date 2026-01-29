import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/UserContext";

const TextInputField = ({
  val,
  setVal,
  placeholder,
  password,
}: {
  val: string;
  setVal: (v: string) => void;
  placeholder: string;
  password?: boolean;
}) => {
  return (
    <input
      type={password ? "password" : "text"}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#2A2A2A] p-3 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
};

const AuthForm = () => {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { login } = useUserContext();
  const navigate = useNavigate();

  const handleSubmit = () => {
    setError("");
    setSuccess("");
    setLoading(true);

    setTimeout(() => {
      if (!phoneNumber || !password || (!isLogin && !name)) {
        setError("All fields are required");
        setLoading(false);
        return;
      }

      if (isLogin) {
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mocktoken123";
        login(token);
        navigate("/", { replace: true });
      } else {
        setSuccess("Account created successfully. Please login.");
        setIsLogin(true);
      }

      setName("");
      setPhoneNumber("");
      setPassword("");
      setLoading(false);
    }, 800);
  };

  return (
    <div className="bg-[#3C3C3C] w-84 rounded-md flex flex-col gap-5 pb-7">
      <h2 className="text-4xl font-semibold text-center py-4 border-b border-white/10">
        {isLogin ? "Sign In" : "Create Account"}
      </h2>

      {error && <div className="px-3 text-red-300 text-sm">{error}</div>}
      {success && <div className="px-3 text-green-300 text-sm">{success}</div>}

      <div className="p-3 flex flex-col gap-4">
        {!isLogin && (
          <TextInputField val={name} setVal={setName} placeholder="Full Name" />
        )}

        <TextInputField
          val={phoneNumber}
          setVal={setPhoneNumber}
          placeholder="Phone Number"
        />
        <TextInputField
          val={password}
          setVal={setPassword}
          placeholder="Password"
          password
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-darkBG p-3 rounded-md text-lg disabled:opacity-50"
        >
          {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
        </button>
      </div>

      <p className="text-center text-sm">
        {isLogin ? (
          <>
            No account?{" "}
            <span
              className="underline cursor-pointer"
              onClick={() => setIsLogin(false)}
            >
              Create one
            </span>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <span
              className="underline cursor-pointer"
              onClick={() => setIsLogin(true)}
            >
              Login
            </span>
          </>
        )}
      </p>
    </div>
  );
};

export default AuthForm;
