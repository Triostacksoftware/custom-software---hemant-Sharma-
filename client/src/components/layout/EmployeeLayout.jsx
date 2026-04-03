import React from 'react';

const EmployeeLayout = ({ children }) => {
    // A simple, invisible wrapper matching your Admin/Member setup
    return (
        <>
            {children}
        </>
    );
};

export default EmployeeLayout;