import React, { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/UserContext";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn, loading } = useUserContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate("/auth", { replace: true });
    }
  }, [isLoggedIn, loading, navigate]);

  if (loading) return null; // or loader

  return <>{children}</>;
};

export default ProtectedRoute;
