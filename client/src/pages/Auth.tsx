import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/UserContext";
import AuthForm from "../components/AuthForm";

const Auth = () => {
  const { isLoggedIn, loading } = useUserContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isLoggedIn) {
      navigate("/", { replace: true });
    }
  }, [isLoggedIn, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <AuthForm />
    </div>
  );
};

export default Auth;
