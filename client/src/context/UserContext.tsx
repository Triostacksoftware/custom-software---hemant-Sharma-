import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type UserContextType = {
  isLoggedIn: boolean;
  userToken: string | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType | null>(null);

const UserProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore auth on refresh
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      setUserToken(token);
      setIsLoggedIn(true);
    }
    setLoading(false);
  }, []);

  const login = (token: string) => {
    localStorage.setItem("authToken", token);
    setUserToken(token);
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    setUserToken(null);
    setIsLoggedIn(false);
  };

  return (
    <UserContext.Provider
      value={{ isLoggedIn, userToken, loading, login, logout }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;

export const useUserContext = () => {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUserContext must be used inside UserProvider");
  }
  return ctx;
};
