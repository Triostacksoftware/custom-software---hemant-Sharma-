import api from './axiosConfig';

export const adminApi = {
    // Group Management
    groups: {
        create: (data) => api.post('/admin/create_group/', data),
        fetchAll: (params = {}) => api.get('/admin/groups/fetch_all', { params }),
        details: (groupId) => api.get(`/admin/group/details/${groupId}`),
        addMember: (groupId, userId) =>
            api.post(`/admin/group/add_member/${groupId}`, { userId }),
        activate: (groupId) =>
            api.post(`/admin/group/activate_group/${groupId}`),
    },

    // User Management
    users: {
        listPending: (params = {}) =>
            api.get('/admin/users/fetch/pending_user/', { params }),
        approve: (userId) =>
            api.post('/admin/users/approve_user/', { userId }),
        reject: (userId) =>
            api.post('/admin/users/reject_user/', { userId }),
        fetchAll: (params = {}) =>
            api.get('/admin/users/fetch_all', { params }),
    },

    // Employee Management
    employees: {
        listPending: (params = {}) =>
            api.get('/admin/employees/fetch/pending_employee/', { params }),
        approve: (employeeId) =>
            api.post('/admin/employees/approve_employee/', { employeeId }),
        reject: (employeeId) =>
            api.post('/admin/employees/reject_employee/', { employeeId }),
        fetchAll: (params = {}) =>
            api.get('/admin/employees/fetch_all', { params }),
    },

    // Dashboard Stats (if available)
    dashboard: {
        stats: () => api.get('/admin/dashboard/stats/'),
    }
};

export default adminApi;