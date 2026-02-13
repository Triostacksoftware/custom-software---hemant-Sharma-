import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AdminRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    // Only check if authenticated
    // Backend will validate admin role
    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AdminRoute;