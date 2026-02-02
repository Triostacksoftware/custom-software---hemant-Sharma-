import React from "react";
import { Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import YourPools from "./pages/YourPools";
import Pool from "./pages/Pool";
import Employee from "./pages/Employee";
import EmployeeRoute from "./pages/EmployeeRoute";

const App = () => {
  return (
    <main className="min-h-screen bg-darkBG text-white">
      <Routes>
        <Route path="/auth" element={<Auth />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/pools/joined"
          element={
            <ProtectedRoute>
              <YourPools />
            </ProtectedRoute>
          }
        />

        <Route 
          element={
            <ProtectedRoute>
              <Pool />
            </ProtectedRoute>
          }
          path="/pools/:poolId"
        />

        <Route 
          element={
          <ProtectedRoute>
            <EmployeeRoute>
              <Employee />
            </EmployeeRoute>
          </ProtectedRoute>}

          path="/employee"
        
        />
      </Routes>
    </main>
  );
};

export default App;
