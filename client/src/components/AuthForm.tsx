import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/UserContext";

/* ---------- MOCK BACKEND ---------- */
type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

interface MockEmployee {
  name: string;
  phoneNumber: string;
  password: string;
  approvalStatus: ApprovalStatus;
}

const mockEmployeeDB: MockEmployee[] = [
  {
    name: "Approved Employee",
    phoneNumber: "+911234567890",
    password: "password123",
    approvalStatus: "APPROVED",
  },
  {
    name: "Pending Employee",
    phoneNumber: "+919999999999",
    password: "password123",
    approvalStatus: "PENDING",
  },
  {
    name: "Rejected Employee",
    phoneNumber: "+918888888888",
    password: "password123",
    approvalStatus: "REJECTED",
  },
];


const mockEmployeeSignup = (
  name: string,
  phoneNumber: string,
  password: string
) => {
  const exists = mockEmployeeDB.find(e => e.phoneNumber === phoneNumber);
  if (exists) {
    throw new Error("Employee already exists");
  }

  mockEmployeeDB.push({
    name,
    phoneNumber,
    password,
    approvalStatus: "PENDING",
  });

  return {
    success: true,
    message: "Signup successful. Awaiting admin approval",
  };
};

const mockEmployeeLogin = (phoneNumber: string, password: string) => {
  const employee = mockEmployeeDB.find(e => e.phoneNumber === phoneNumber);

  if (!employee) {
    throw new Error("Employee does not exist");
  }

  if (employee.approvalStatus === "REJECTED") {
    throw new Error("Your request was rejected by admin");
  }

  if (employee.approvalStatus !== "APPROVED") {
    throw new Error("Awaiting admin approval");
  }

  if (employee.password !== password) {
    throw new Error("Incorrect password");
  }

  return {
    success: true,
    token: `mock-jwt-employee-${Date.now()}`,
  };
};

type Mode = "USER" | "EMPLOYEE";

const TextInput = ({ value, onChange, placeholder, type = "text" }: any) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full bg-[#2A2A2A] p-3 rounded-md text-white"
  />
);

const AuthForm = () => {
  const [mode, setMode] = useState<Mode>("USER");
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

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
      try {
        if (!phoneNumber || !password || (!isLogin && mode === "EMPLOYEE" && !name)) {
          throw new Error("All fields are required");
        }

        // USER LOGIN (mock)
        if (mode === "USER") {
          login("mock-user-token", "user");
          navigate("/");
          return;
        }

        // EMPLOYEE SIGNUP
        if (!isLogin) {
          const res = mockEmployeeSignup(name, phoneNumber, password);
          setSuccess(res.message);
          setIsLogin(true);
          return;
        }

        // EMPLOYEE LOGIN
        const res = mockEmployeeLogin(phoneNumber, password);
        login(res.token, "employee");
        navigate("/employee");

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 700); // simulate network delay
  };

  return (
    <div className="bg-[#3C3C3C] w-full max-w-md rounded-md p-6 flex flex-col gap-5">
      <h2 className="text-2xl font-semibold text-center">
        {mode === "USER" ? "User Auth" : "Employee Auth"}
      </h2>

      {/* MODE SWITCH */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("USER")}
          className={`flex-1 p-2 rounded ${
            mode === "USER" ? "bg-black" : "bg-zinc-700"
          }`}
        >
          User
        </button>
        <button
          onClick={() => setMode("EMPLOYEE")}
          className={`flex-1 p-2 rounded ${
            mode === "EMPLOYEE" ? "bg-black" : "bg-zinc-700"
          }`}
        >
          Employee
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}

      {!isLogin && mode === "EMPLOYEE" && (
        <TextInput value={name} onChange={setName} placeholder="Full Name" />
      )}

      <TextInput
        value={phoneNumber}
        onChange={setPhoneNumber}
        placeholder="Phone Number"
      />

      <TextInput
        value={password}
        onChange={setPassword}
        placeholder="Password"
        type="password"
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-black p-3 rounded-md disabled:opacity-50"
      >
        {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
      </button>

      {mode === "EMPLOYEE" && (
        <p className="text-center text-sm">
          {isLogin ? (
            <>
              New employee?{" "}
              <span
                className="underline cursor-pointer"
                onClick={() => setIsLogin(false)}
              >
                Request access
              </span>
            </>
          ) : (
            <>
              Already registered?{" "}
              <span
                className="underline cursor-pointer"
                onClick={() => setIsLogin(true)}
              >
                Login
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
};

export default AuthForm;
