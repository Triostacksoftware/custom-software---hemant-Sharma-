import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/adminApi';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    XCircle,
    Users,
    Briefcase
} from 'lucide-react';
import './Approvals.css';

const Approvals = () => {
    // Tab state: 'users' or 'employees'
    const [activeTab, setActiveTab] = useState('users');

    // Shared state for both tabs
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        currentPage: 1,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [actionLoading, setActionLoading] = useState({}); // track per item

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page when tab, search, or pageSize changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, debouncedSearch, pageSize]);

    // Fetch pending items based on active tab
    const fetchPending = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const params = {
                page: currentPage,
                limit: pageSize,
                search: debouncedSearch || undefined,
            };

            let response;
            if (activeTab === 'users') {
                response = await adminApi.users.listPending(params);
            } else {
                response = await adminApi.employees.listPending(params);
            }

            const { data } = response.data;

            // API returns either 'users' or 'employees' array – adjust accordingly
            // Based on controller: for users it's probably 'users', for employees it's 'employees'
            const key = activeTab === 'users' ? 'users' : 'employees';
            setItems(data[key] || []);
            setPagination(data.pagination);
        } catch (err) {
            setError(err.response?.data?.message || `Failed to fetch pending ${activeTab}`);
            console.error(`Fetch pending ${activeTab} error:`, err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, currentPage, pageSize, debouncedSearch]);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
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

    const handleApprove = async (id, itemName) => {

        // Show confirmation dialog
        const confirmMessage = `Are you sure you want to approve "${itemName}"?`;
        if (!window.confirm(confirmMessage)) {
            return; // User cancelled
        }

        setActionLoading(prev => ({ ...prev, [id]: 'approve' }));
        try {
            if (activeTab === 'users') {
                await adminApi.users.approve(id);
            } else {
                await adminApi.employees.approve(id);
            }
            // Remove the approved item from list
            setItems(prev => prev.filter(item => item._id !== id));
            // Optionally show success toast – for simplicity, just refresh
            // Also update total count
            setPagination(prev => ({
                ...prev,
                total: prev.total - 1,
                totalPages: Math.ceil((prev.total - 1) / pageSize),
            }));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to approve');
        } finally {
            setActionLoading(prev => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
            });
        }
    };

    const handleReject = async (id, itemName) => {

        // Show confirmation dialog
        const confirmMessage = `Are you sure you want to reject "${itemName}"?`;
        if (!window.confirm(confirmMessage)) {
            return; // User cancelled
        }

        setActionLoading(prev => ({ ...prev, [id]: 'reject' }));
        try {
            if (activeTab === 'users') {
                await adminApi.users.reject(id);
            } else {
                await adminApi.employees.reject(id);
            }
            // Remove the rejected item from list
            setItems(prev => prev.filter(item => item._id !== id));
            setPagination(prev => ({
                ...prev,
                total: prev.total - 1,
                totalPages: Math.ceil((prev.total - 1) / pageSize),
            }));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reject');
        } finally {
            setActionLoading(prev => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
            });
        }
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
        <div className="approvals-page">
            <div className="approvals-header">
                <div>
                    <h1 className="approvals-title">Approvals</h1>
                    <p className="approvals-subtitle">Review and approve pending user and employee registrations</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="approvals-tabs">
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <Users size={18} />
                    <span>Users</span>
                    {!loading && activeTab === 'users' && pagination.total > 0 && (
                        <span className="tab-count">{pagination.total}</span>
                    )}
                </button>
                <button
                    className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
                    onClick={() => setActiveTab('employees')}
                >
                    <Briefcase size={18} />
                    <span>Employees</span>
                    {!loading && activeTab === 'employees' && pagination.total > 0 && (
                        <span className="tab-count">{pagination.total}</span>
                    )}
                </button>
            </div>

            {/* Controls */}
            <div className="approvals-controls">
                <div className="search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder={`Search ${activeTab === 'users' ? 'users' : 'employees'} by name or phone...`}
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
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
                <div className="approvals-error">
                    <strong>Error:</strong> {error}
                    <button onClick={fetchPending}>Retry</button>
                </div>
            )}

            {/* Table */}
            <div className="approvals-table-container">
                {loading ? (
                    <div className="approvals-loading">
                        <div className="spinner"></div>
                        <p>Loading pending {activeTab}...</p>
                    </div>
                ) : (
                    <>
                        <table className="approvals-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone Number</th>
                                    <th>Registered On</th>
                                    <th className="actions-column">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="no-data">
                                            No pending {activeTab} found.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => (
                                        <tr key={item._id}>
                                            <td className="item-name">{item.name}</td>
                                            <td className="item-phone">{item.phoneNumber}</td>
                                            <td className="item-date">{formatDate(item.createdAt)}</td>
                                            <td className="actions-cell">
                                                <button
                                                    className="action-btn approve"
                                                    onClick={() => handleApprove(item._id, item.name)}
                                                    disabled={actionLoading[item._id]}
                                                >
                                                    {actionLoading[item._id] === 'approve' ? (
                                                        <span className="spinner-small"></span>
                                                    ) : (
                                                        <>
                                                            <CheckCircle size={16} />
                                                            <span>Approve</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    className="action-btn reject"
                                                    onClick={() => handleReject(item._id, item.name)}
                                                    disabled={actionLoading[item._id]}
                                                >
                                                    {actionLoading[item._id] === 'reject' ? (
                                                        <span className="spinner-small"></span>
                                                    ) : (
                                                        <>
                                                            <XCircle size={16} />
                                                            <span>Reject</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>
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

export default Approvals;