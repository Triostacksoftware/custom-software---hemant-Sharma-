import { Navigate, Outlet } from "react-router-dom";

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem("admin_token");
  const role = localStorage.getItem("role");

  // not logged in or not admin
  if (!token || role !== "ADMIN") {
    return <Navigate to="/admin/auth" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
