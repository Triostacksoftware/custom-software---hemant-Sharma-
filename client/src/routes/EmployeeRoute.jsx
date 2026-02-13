import React from 'react';
import ProtectedRoute from './ProtectedRoute';

const EmployeeRoute = ({ children }) => {
    return (
        <ProtectedRoute allowedRoles={['employee']}>
            {children}
        </ProtectedRoute>
    );
};

export default EmployeeRoute;