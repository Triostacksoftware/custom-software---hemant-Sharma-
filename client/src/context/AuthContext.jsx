import React, { createContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                    atob(base64)
                        .split('')
                        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                );

                const decodedUser = JSON.parse(jsonPayload);
                if (decodedUser.exp * 1000 > Date.now()) {
                    setUser({ token, ...decodedUser });
                } else {
                    localStorage.removeItem('token');
                }
            } catch (error) {
                localStorage.removeItem('token');
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
                throw new Error(data.error || 'Login failed');
            }

            const token = data.token;
            localStorage.setItem('token', token);

            // Decode token to get user info
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );

            const decodedUser = JSON.parse(jsonPayload);
            // Store only the role from login attempt (for UI display only)
            setUser({ token, role, ...decodedUser });

            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Login failed'
            };
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
                throw new Error(data.error || 'Signup failed');
            }

            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Signup failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
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