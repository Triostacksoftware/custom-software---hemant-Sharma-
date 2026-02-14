import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import './Members.css';

const Members = () => {
    const [members, setMembers] = useState([]);
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

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, pageSize]);

    const fetchMembers = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const params = {
                page: currentPage,
                limit: pageSize,
                search: debouncedSearch || undefined,
            };

            const response = await adminApi.users.fetchAll(params);
            const { data } = response.data;

            setMembers(data.members);
            setPagination(data.pagination);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch members');
            console.error('Fetch members error:', err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="members-page">
            <div className="members-header">
                <div>
                    <h1 className="members-title">Member Management</h1>
                    <p className="members-subtitle">View and manage all registered members</p>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="members-controls">
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
                <div className="members-error">
                    <strong>Error:</strong> {error}
                    <button onClick={fetchMembers}>Retry</button>
                </div>
            )}

            {/* Members Table */}
            <div className="members-table-container">
                {loading ? (
                    <div className="members-loading">
                        <div className="spinner"></div>
                        <p>Loading members...</p>
                    </div>
                ) : (
                    <>
                        <table className="members-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone Number</th>
                                    <th>Approval Status</th>
                                    <th>Registered On</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="no-data">
                                            No members found.
                                        </td>
                                    </tr>
                                ) : (
                                    members.map((member) => (
                                        <tr key={member._id}>
                                            <td className="member-name">
                                                <Link to={`/admin/member/${member._id}`} className="member-link">
                                                    {member.name}
                                                </Link>
                                            </td>
                                            <td className="member-phone">{member.phoneNumber}</td>
                                            <td>
                                                <span className={getStatusBadgeClass(member.approvalStatus)}>
                                                    {member.approvalStatus}
                                                </span>
                                            </td>
                                            <td className="member-date">{formatDate(member.createdAt)}</td>
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

export default Members;