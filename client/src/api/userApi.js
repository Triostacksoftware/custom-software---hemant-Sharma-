import api from './axiosConfig';

export const userApi = {
    // Dashboard
    getDashboard: () => api.get('/user/dashboard'),

    // Group details
    getGroupDetails: (groupId) => api.get(`/user/groups/${groupId}`),

    // Place a bid
    placeBid: (data) => api.post('/user/bid/place', data),

    // Confirm transaction (contribution or payout)
    confirmTransaction: (data) => api.post('/user/transaction/confirm', data),

    //get employees list for transaction confirmation
    getEmployees: () => api.get('/member/get_employees/'),
};

export default userApi;