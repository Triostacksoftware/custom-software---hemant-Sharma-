import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/adminApi';
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import './Employees.css';

const Employees = () => {
    const [employees, setEmployees] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        currentPage: 1,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, pageSize]);

    const fetchEmployees = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const params = {
                page: currentPage,
                limit: pageSize,
                search: debouncedSearch || undefined,
                approvalStatus: statusFilter || undefined,
            };

            const response = await adminApi.employees.fetchAll(params);
            const { data } = response.data;

            setEmployees(data.employees);
            setPagination(data.pagination);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch employees');
            console.error('Fetch employees error:', err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch, statusFilter]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handlePageSizeChange = (e) => {
        setPageSize(Number(e.target.value));
        setCurrentPage(1);
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'APPROVED':
                return 'status-badge approved';
            case 'PENDING':
                return 'status-badge pending';
            case 'REJECTED':
                return 'status-badge rejected';
            default:
                return 'status-badge';
        }
    };

    const getRoleBadgeClass = (role) => {
        return role === 'ADMIN' ? 'role-badge admin' : 'role-badge employee';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="employees-page">
            <div className="employees-header">
                <div>
                    <h1 className="employees-title">Employee Management</h1>
                    <p className="employees-subtitle">View and manage all employees and administrators</p>
                </div>
            </div>

            {/* Controls */}
            <div className="employees-controls">
                <div className="search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by name or phone number..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
                </div>

                <div className="filter-wrapper">
                    <Filter size={18} className="filter-icon" />
                    <select
                        className="status-filter"
                        value={statusFilter}
                        onChange={handleStatusChange}
                    >
                        <option value="">All</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                </div>

                <div className="page-size-selector">
                    <label htmlFor="pageSize">Show</label>
                    <select
                        id="pageSize"
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="page-size-select"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                    <span>entries</span>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="employees-error">
                    <strong>Error:</strong> {error}
                    <button onClick={fetchEmployees}>Retry</button>
                </div>
            )}

            {/* Employees Table */}
            <div className="employees-table-container">
                {loading ? (
                    <div className="employees-loading">
                        <div className="spinner"></div>
                        <p>Loading employees...</p>
                    </div>
                ) : (
                    <>
                        <table className="employees-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone Number</th>
                                    <th>Approval Status</th>
                                    <th>Role</th>
                                    <th>Registered On</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="no-data">
                                            No employees found.
                                        </td>
                                    </tr>
                                ) : (
                                    employees.map((employee) => (
                                        <tr key={employee._id}>
                                            <td className="employee-name">{employee.name}</td>
                                            <td className="employee-phone">{employee.phoneNumber}</td>
                                            <td>
                                                <span className={getStatusBadgeClass(employee.approvalStatus)}>
                                                    {employee.approvalStatus}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={getRoleBadgeClass(employee.role)}>
                                                    {employee.role}
                                                </span>
                                            </td>
                                            <td className="employee-date">{formatDate(employee.createdAt)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft size={16} />
                                    Previous
                                </button>

                                <span className="pagination-info">
                                    Page {pagination.currentPage} of {pagination.totalPages}
                                </span>

                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === pagination.totalPages}
                                >
                                    Next
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Employees;