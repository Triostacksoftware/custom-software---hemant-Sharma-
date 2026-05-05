import api from './axiosConfig';

export const adminApi = {
    // Group Management
    groups: {
        create: (data) => api.post('/admin/create_group/', data),
        fetchAll: (params = {}) => api.get('/admin/groups/fetch_all', { params }),
        details: (groupId) => api.get(`/admin/group/fetch/group_details/${groupId}`),
        addMember: (groupId, userId) =>
            api.post(`/admin/group/add_member/${groupId}`, { userId }),
        activate: (groupId) =>
            api.post(`/admin/group/activate_group/${groupId}`),
    },

    // User (Member) Management
    users: {
        listPending: (params = {}) =>
            api.get('/admin/users/fetch/pending_user/', { params }),
        approve: (userId) =>
            api.post('/admin/users/approve_user/', { userId }),
        reject: (userId) =>
            api.post('/admin/users/reject_user/', { userId }),
        fetchAll: (params = {}) =>
            api.get('/admin/users/fetch_all', { params }),
        details: (userId) =>
            api.get(`/admin/users/fetch/details/${userId}`),
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
        getHistory: (employeeId, params = {}) =>
            api.get(`/admin/employees/fetch/history/${employeeId}`, { params }),

        getSingleCashInHand: (employeeId) => api.get(`/admin/employees/${employeeId}/cash-in-hand`),
    },

    // Bidding Actions
    bidding: {
        getCurrentRound: (groupId) => api.get(`/admin/bidding/current/${groupId}`),
        open: (data) => api.post('/admin/bidding/open', data),
        close: (data) => api.post('/admin/bidding/close', data),
        resolveTie: (data) =>
            api.post('/admin/bidding/resolve-tie', data),
        finalize: (data) => api.post('/admin/bidding/finalize', data),
        getBids: (roundId) => api.get(`/admin/bidding/round/${roundId}/bids`),
        updateTerms: (roundId, data) => api.patch(`/admin/bidding/update-terms/${roundId}`, data), // <-- NEW ENDPOINT
    },

    // Collection Management
    collections: {
        getPending: (params = {}) => api.get('/admin/collections/pending', { params }),
        sendReminder: (data) => api.post('/admin/collections/remind', data),
    },

    // Payout Management
    payouts: {
        getPending: (params = {}) => api.get('/admin/payouts/pending', { params }),
    },

    // Advertisement Management
    ads: {
        create: (data) => api.post('/admin/ads', data),
        fetchAll: () => api.get('/admin/ads'),
        update: (adId, data) => api.patch(`/admin/ads/${adId}`, data),
        activate: (adId) => api.patch(`/admin/ads/${adId}/activate`),
        deactivate: (adId) => api.patch(`/admin/ads/${adId}/deactivate`),
        delete: (adId) => api.delete(`/admin/ads/${adId}`)
    },

    // Dashboard Stats
    getDashboardStats: () => api.get('/admin/dashboard/stats/'),

    // === Notification Endpoints ===
    getUnreadNotifications: () => api.get('/admin/notifications/unread-count'),
    getNotificationsList: (unreadOnly = false, limit = 5, page = 1) => {
        let url = `/admin/notifications?page=${page}&limit=${limit}`;
        if (unreadOnly) url += `&unreadOnly=true`;
        return api.get(url);
    },
    savePushSubscription: (data) => api.post('/admin/push-subscription', data),
};

export default adminApi;