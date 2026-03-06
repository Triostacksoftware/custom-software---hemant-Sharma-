import api from './axiosConfig';

export const employeeApi = {
    // Dashboard
    getDashboard: () => api.get('/employee/dashboard/'),

    // Active groups
    getActiveGroups: () => api.get('/employee/groups/active'),

    // Pending transactions (contributions + payout) for a group
    getPendingTransactions: (groupId) => api.get(`/employee/groups/${groupId}/pending_members/`),

    // Log transaction (contribution or payout)
    logTransaction: (data) => api.post('/employee/group/contribution/log_contribution/', data),

    // Contribution history (future)
    getHistory: (params) => api.get('/employee/contributions/history/', { params }),
};

export default employeeApi;