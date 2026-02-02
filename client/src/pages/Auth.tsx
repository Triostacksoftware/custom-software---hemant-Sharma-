import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/UserContext";
import AuthForm from "../components/AuthForm";

const Auth = () => {
  const { isLoggedIn, loading, role } = useUserContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (isLoggedIn) {
      console.log("Role:", role);
      if (role === "employee") {
        navigate("/employee", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [isLoggedIn, role, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md">
        <AuthForm />
      </div>
    </div>
  );
};

export default Auth;