import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/UserContext";

const EmployeeRoute = ({ children }: { children: ReactNode }) => {
  const { role, loading } = useUserContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== "employee") {
      navigate("/", { replace: true });
    }
  }, [role, loading, navigate]);

  if (loading) return null;

  return <>{children}</>;
};

export default EmployeeRoute;
