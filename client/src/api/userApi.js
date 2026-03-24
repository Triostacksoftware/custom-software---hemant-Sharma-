import api from './axiosConfig';

export const userApi = {
    // === Dashboard Endpoints ===
    getDashboardStats: () => api.get('/user/dashboard'),
    getUnreadNotifications: () => api.get('/user/notifications/unread-count'),
    getActiveAd: () => api.get('/user/ads/active'),
    getNotificationsList: (unreadOnly = false, limit = 5, page = 1) => {
        let url = `/user/notifications?page=${page}&limit=${limit}`;
        if (unreadOnly) url += `&unreadOnly=true`;
        return api.get(url);
    },

    // === Group & Bidding Endpoints ===
    getAllGroups: () => api.get('/user/groups'),
    requestToJoinGroup: (groupId) => api.post(`/user/groups/${groupId}/join`),
    getGroupDetails: (groupId) => api.get(`/user/groups/${groupId}`),
    placeBid: (data) => api.post('/user/bid/place', data),

    // === Transaction Endpoints ===
    confirmTransaction: (data) => api.post('/user/transaction/confirm', data),
    getEmployees: () => api.get('/member/get_employees/'),
    getTransactionHistory: (page = 1, limit = 10, type = null) => {
        let url = `/user/transactions?page=${page}&limit=${limit}`;
        if (type) url += `&type=${type}`;
        return api.get(url);
    },
};

export default userApi;