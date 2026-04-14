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
    getBiddingDashboard: () => api.get('/user/bidding/dashboard'),
    getBiddingRoomDetails: (roundId) => api.get(`/user/bidding/room/${roundId}`),
    placeBid: (data) => api.post('/user/bid/place', data),

    // === Transaction Endpoints ===
    confirmTransaction: (data) => api.post('/user/transaction/confirm', data),
    getEmployees: () => api.get('/member/get_employees/'),
    getTransactionHistory: (params = {}) => api.get('/user/transactions', { params }),
    getPendingDues: () => api.get('/user/requests/pending-dues'),

    // === NEW: Raise Request Endpoint ===
    raisePaymentRequest: (data) => api.post('/user/requests/raise', data),

    // === Push Notifications ===
    savePushSubscription: (data) => api.post('/user/push-subscription', data),
};

export default userApi;