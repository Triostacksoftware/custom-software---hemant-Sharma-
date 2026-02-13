import api from './axiosConfig';

export const authApi = {
    // User (Member) endpoints
    user: {
        signup: (data) => api.post('/user/signup/', data),
        login: (data) => api.post('/user/login/', data),
    },

    // Employee endpoints
    employee: {
        signup: (data) => api.post('/employee/signup/', data),
        login: (data) => api.post('/employee/login/', data),
    },

    // Admin endpoints
    admin: {
        login: (data) => api.post('/admin/login/', data),
    },
};