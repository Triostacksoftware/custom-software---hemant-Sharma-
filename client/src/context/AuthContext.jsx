import React, { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { authApi } from '../api/authApi';
import { adminApi } from '../api/adminApi';
import { employeeApi } from '../api/employeeApi';
import { userApi } from '../api/userApi';
import { setupPushNotifications } from '../utils/setupPushNotifications';

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
    const [globalSocket, setGlobalSocket] = useState(null); // Added to hold personal socket

    // Initial Load & Token Validation
    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('userRole');
        const name = localStorage.getItem('userName');

        if (token && role) {
            const decoded = decodeToken(token);
            const userId = decoded?.employeeId || decoded?.userId || decoded?.id;
            if (decoded && decoded.exp * 1000 > Date.now()) {
                setUser({
                    token,
                    role,
                    name: decoded.name,
                    _id: userId,
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

    // === NEW: Global Socket & Push Notification Initialization ===
    useEffect(() => {
        if (user && user._id) {
            // 1. Establish Personal Socket Room Connection
            const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            const socket = io(socketUrl);

            // Emit the join command based on your backend convention
            // Note: Admin uses the Employee model, so their role for the room is "employee"
            const socketRole = user.role === 'admin' ? 'employee' : user.role;
            socket.emit("joinPersonalRoom", { id: user._id, role: socketRole });

            setGlobalSocket(socket);

            // 2. Register Web Push Notifications
            let saveSubFn;
            if (user.role === 'admin') saveSubFn = adminApi.savePushSubscription;
            else if (user.role === 'employee') saveSubFn = employeeApi.savePushSubscription;
            else if (user.role === 'user') saveSubFn = userApi.savePushSubscription;

            if (saveSubFn) {
                // This triggers the permission prompt and saves the token to DB
                setupPushNotifications(saveSubFn);
            }

            // Cleanup socket on unmount or user change
            return () => {
                socket.disconnect();
            };
        } else {
            setGlobalSocket(null);
        }
    }, [user]);

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

            // Store user ID from token
            const userId = decoded?.employeeId || decoded?.userId || decoded?.id;

            localStorage.setItem('token', token);
            localStorage.setItem('userRole', role);
            if (decoded?.name) {
                localStorage.setItem('userName', decoded.name);
            }

            setUser({
                token,
                role,
                name: decoded?.name,
                _id: userId,
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
        if (globalSocket) {
            globalSocket.disconnect();
        }
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
            socket: globalSocket // Exporting socket so Notification Bell can listen to it!
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export { AuthContext };