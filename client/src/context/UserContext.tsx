import React, { createContext, useContext, useEffect, useState } from "react";

type Role = "user" | "employee";

interface UserContextType {
  isLoggedIn: boolean;
  role: Role | null;
  loading: boolean;
  login: (token: string, role: Role) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const r = localStorage.getItem("role") as Role | null;

    if (t && r) {
      setToken(t);
      setRole(r);
    }
    setLoading(false);
  }, []);

  const login = (token: string, role: Role) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    setToken(token);
    setRole(role);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  return (
    <UserContext.Provider
      value={{ isLoggedIn: !!token, role, loading, login, logout }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;

export const useUserContext = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext outside provider");
  return ctx;
};
