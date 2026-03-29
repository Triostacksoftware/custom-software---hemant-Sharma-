import React from 'react';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
    // The new design uses full-screen pages with their own headers.
    // The sidebar has been removed to allow the Dashboard to take the full screen.
    return (
        <div className="admin-layout-wrapper">
            {children}
        </div>
    );
};

export default AdminLayout;