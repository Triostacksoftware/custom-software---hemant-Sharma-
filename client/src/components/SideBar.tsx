import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Menu,
  X,
  Target,
  PenSquare,
  LogOut,
  Briefcase,
} from "lucide-react";
import { useUserContext } from "../context/UserContext";

const SideBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, logout } = useUserContext();
  const [isOpen, setIsOpen] = useState(false);

  // ---------------- ROLE BASED NAV ----------------

  const userNav = [
    { icon: Home, path: "/", label: "Home" },
    { icon: PenSquare, path: "/pools/joined", label: "Your Pools" },
  ];

  const employeeNav = [
    { icon: Briefcase, path: "/employee", label: "Dashboard" },
  ];

  const navItems = role === "employee" ? employeeNav : userNav;

  // ---------------- UI ----------------

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-white md:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:sticky top-0 left-0 h-screen w-20 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 gap-2 z-40 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
          <Target size={24} className="text-white" />
        </div>

        {/* Nav */}
        <div className="flex flex-col gap-2 w-full items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsOpen(false);
                }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center relative group transition-all ${
                  active
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                }`}
              >
                <Icon size={20} />

                <span className="absolute left-16 bg-zinc-800 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-zinc-700">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-grow" />

        {/* Logout */}
        <button
          className="w-12 h-12 bg-red-800 hover:bg-red-700 rounded-xl flex items-center justify-center"
          onClick={() => {
            logout();
            navigate("/auth", { replace: true });
          }}
        >
          <LogOut size={20} className="text-white" />
        </button>
      </div>
    </>
  );
};

export default SideBar;
