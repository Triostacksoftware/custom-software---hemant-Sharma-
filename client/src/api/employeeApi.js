import api from './axiosConfig';

export const employeeApi = {
    // Dashboard
    getDashboard: () => api.get('/employee/dashboard/'),

    // Active groups (new)
    getActiveGroups: () => api.get('/employee/groups/active/'),

    // Pending members for a group
    getPendingMembers: (groupId) => api.get(`/employee/groups/${groupId}/pending_members/`),

    //Contribution logging
    logContribution: (data) => api.post('/employee/group/contribution/log_contribution/', data),

    // Contribution history
    // getHistory: (params) => api.get('/employee/contributions/history/', { params }),
};

export default employeeApi;