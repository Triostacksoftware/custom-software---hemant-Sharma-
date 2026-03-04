import React from 'react';
import ProtectedRoute from './ProtectedRoute';

const MemberRoute = ({ children }) => {
    return (
        <ProtectedRoute allowedRoles={['user']}>
            {children}
        </ProtectedRoute>
    );
};

export default MemberRoute;