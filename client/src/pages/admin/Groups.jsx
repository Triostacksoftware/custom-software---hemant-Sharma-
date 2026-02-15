import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import './Groups.css';

const Groups = () => {
    const [groups, setGroups] = useState([]);
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

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to page 1 when search, filter, or pageSize changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, pageSize]);

    const fetchGroups = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const params = {
                page: currentPage,
                limit: pageSize,
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
            };

            const response = await adminApi.groups.fetchAll(params);
            const { data } = response.data;

            setGroups(data.groups);
            setPagination(data.pagination);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch groups');
            console.error('Fetch groups error:', err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch, statusFilter]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

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
            case 'ACTIVE':
                return 'status-badge active';
            case 'DRAFT':
                return 'status-badge draft';
            case 'COMPLETED':
                return 'status-badge completed';
            default:
                return 'status-badge';
        }
    };

    const formatDuration = (months) => {
        return `${months} ${months === 1 ? 'month' : 'months'}`;
    };

    return (
        <div className="groups-page">
            <div className="groups-header">
                <div>
                    <h1 className="groups-title">Group Management</h1>
                    <p className="groups-subtitle">View and manage all groups</p>
                </div>
                <Link to="/admin/create-group" className="create-group-btn">
                    + Create New Group
                </Link>
            </div>

            {/* Controls */}
            <div className="groups-controls">
                <div className="search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search groups by name..."
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
                        <option value="">All Status</option>
                        <option value="DRAFT">Draft</option>
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
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
                <div className="groups-error">
                    <strong>Error:</strong> {error}
                    <button onClick={fetchGroups}>Retry</button>
                </div>
            )}

            {/* Groups Table */}
            <div className="groups-table-container">
                {loading ? (
                    <div className="groups-loading">
                        <div className="spinner"></div>
                        <p>Loading groups...</p>
                    </div>
                ) : (
                    <>
                        <table className="groups-table">
                            <thead>
                                <tr>
                                    <th>Group Name</th>
                                    <th>Status</th>
                                    <th>Members</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="no-data">
                                            No groups found.
                                        </td>
                                    </tr>
                                ) : (
                                    groups.map((group) => (
                                        <tr key={group._id}>
                                            <td className="group-name">
                                                <Link to={`/admin/group/${group._id}`} className="group-link">
                                                    {group.name}
                                                </Link>
                                            </td>
                                            <td>
                                                <span className={getStatusBadgeClass(group.status)}>
                                                    {group.status}
                                                </span>
                                            </td>
                                            <td>
                                                {group.memberCount} / {group.totalMembers}
                                            </td>
                                            <td>{formatDuration(group.totalMonths)}</td>
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

export default Groups;