import api from './axiosConfig';

export const employeeApi = {
    // Dashboard
    getDashboard: () => api.get('/employee/dashboard/'),

    // Active groups
    getActiveGroups: () => api.get('/employee/groups/active'),

    // Member Lookups
    getPendingMembers: (groupId, params = {}) => api.get('/employee/pending_members/', {
        params: { ...params, groupId }
    }),

    // Transaction Actions
    initiateTransaction: (data) => api.post('/employee/log_transaction/', data),

    // Transaction history
    getTransactionHistory: (params = {}) => api.get('/employee/transactions/history', { params }),

    // === Notification Endpoints ===
    getUnreadNotifications: () => api.get('/employee/notifications/unread-count'),
    getNotificationsList: (unreadOnly = false, limit = 5, page = 1) => {
        let url = `/employee/notifications?page=${page}&limit=${limit}`;
        if (unreadOnly) url += `&unreadOnly=true`;
        return api.get(url);
    },
    savePushSubscription: (data) => api.post('/employee/push-subscription', data),
};

export default employeeApi;