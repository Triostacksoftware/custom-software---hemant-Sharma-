import React, { createContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

// Helper to decode JWT token
const decodeToken = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Token decode error:', error);
        return null;
    }
};

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('userRole'); // Retrieve stored role

        if (token && role) {
            const decoded = decodeToken(token);
            if (decoded && decoded.exp * 1000 > Date.now()) {
                setUser({
                    token,
                    role,
                    name: decoded.name,
                    employeeId: decoded.employeeId,
                });
            } else {
                // Token expired or invalid – clear storage
                localStorage.removeItem('token');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userName');
            }
        }
        setLoading(false);
    }, []);

    const login = async (role, credentials) => {
        try {
            let response;

            switch (role) {
                case 'admin':
                    response = await authApi.admin.login(credentials);
                    break;
                case 'employee':
                    response = await authApi.employee.login(credentials);
                    break;
                case 'user':
                    response = await authApi.user.login(credentials);
                    break;
                default:
                    throw new Error('Invalid role');
            }

            const { data } = response;

            if (!data.success) {
                throw new Error(data.message || data.error || 'Login failed');
            }

            const token = data.token;
            const decoded = decodeToken(token);

            // Store token and role separately
            localStorage.setItem('token', token);
            localStorage.setItem('userRole', role);
            if (decoded?.name) {
                localStorage.setItem('userName', decoded.name);
            }

            setUser({
                token,
                role,
                name: decoded?.name,
                employeeId: decoded?.employeeId,
            });

            return { success: true, data };
        } catch (error) {
            const errorMessage =
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Login failed';

            return { success: false, error: errorMessage };
        }
    };

    const signup = async (role, userData) => {
        try {
            let response;

            switch (role) {
                case 'employee':
                    response = await authApi.employee.signup(userData);
                    break;
                case 'user':
                    response = await authApi.user.signup(userData);
                    break;
                default:
                    throw new Error('Signup not available for this role');
            }

            const { data } = response;

            if (!data.success) {
                throw new Error(data.error || data.message || 'Signup failed');
            }

            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.response?.data?.message || error.message || 'Signup failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        setUser(null);
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            signup,
            logout,
            loading,
            isAuthenticated: !!user,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export { AuthContext };