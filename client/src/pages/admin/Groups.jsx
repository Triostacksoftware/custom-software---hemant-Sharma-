import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Folder, ChevronLeft, ChevronRight, ArrowRight, PlusCircle } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Groups.css';

const Groups = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [groups, setGroups] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(''); // '', 'DRAFT', 'ACTIVE', 'COMPLETED'
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

    const fetchGroups = useCallback(async (page = 1, search = '', status = '') => {
        setLoading(true);
        setError('');
        try {
            const response = await adminApi.groups.fetchAll({ page, limit: 10, search, status });
            if (response.data.success) {
                setGroups(response.data.data.groups);
                setPagination(response.data.data.pagination);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load groups.');
            setGroups([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGroups(1, searchQuery, statusFilter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchGroups(1, searchQuery, statusFilter);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchGroups(newPage, searchQuery, statusFilter);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(amount || 0);
    };

    return (
        <div className="admin-groups-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Groups Management</h1>
                </div>
                <div className="header-right">
                    <button className="elder-btn-success-solid" onClick={() => navigate('/admin/create-group')}>
                        <PlusCircle size={20} /> New Group
                    </button>
                </div>
            </header>

            <main className="groups-main-content">
                <div className="groups-control-panel">
                    <div className="groups-tabs">
                        <button className={`tab-btn ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
                        <button className={`tab-btn ${statusFilter === 'DRAFT' ? 'active' : ''}`} onClick={() => setStatusFilter('DRAFT')}>Drafts</button>
                        <button className={`tab-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`} onClick={() => setStatusFilter('ACTIVE')}>Active</button>
                        <button className={`tab-btn ${statusFilter === 'COMPLETED' ? 'active' : ''}`} onClick={() => setStatusFilter('COMPLETED')}>Completed</button>
                    </div>

                    <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                        <div className="admin-search-input-wrapper">
                            <Search size={20} className="admin-search-icon" />
                            <input
                                type="text"
                                placeholder="Search groups..."
                                className="admin-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="admin-search-submit-btn">Search</button>
                    </form>
                </div>

                <section className="elder-section">
                    <div className="section-header-flex">
                        <h2 className="elder-section-title">{statusFilter ? `${statusFilter} Groups` : 'All Groups'}</h2>
                        <span className="total-count-badge">{pagination.total} Total</span>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card"><div className="spinner"></div><p>Loading groups...</p></div>
                    ) : error ? (
                        <div className="elder-empty-card"><p className="error-text">{error}</p><button className="elder-btn-primary" onClick={() => fetchGroups(1, searchQuery, statusFilter)}>Retry</button></div>
                    ) : groups.length === 0 ? (
                        <div className="elder-empty-card">
                            <div className="empty-icon-wrapper icon-slate"><Folder size={48} opacity={0.5} /></div>
                            <p>No groups found in this category.</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {groups.map((group) => (
                                <div key={group._id} className="elder-list-card clickable-card" onClick={() => navigate(`/admin/group/${group._id}`)}>
                                    <div className="list-card-left">
                                        <div className="icon-wrapper icon-slate"><Folder size={26} /></div>
                                        <div className="list-card-info">
                                            <div className="title-with-status">
                                                <h3 className="elder-card-title">{group.name}</h3>
                                                <span className={`status-badge ${group.status === 'ACTIVE' ? 'badge-success' : group.status === 'COMPLETED' ? 'badge-slate' : 'badge-warning'}`}>
                                                    {group.status}
                                                </span>
                                            </div>
                                            <div className="person-details-inline">
                                                <span className="detail-text">{formatCurrency(group.monthlyContribution)}/mo</span>
                                                <span className="stat-divider">•</span>
                                                <span className="detail-text">{group.memberCount} / {group.totalMembers} Members</span>
                                                <span className="stat-divider">•</span>
                                                <span className="detail-text">Month {group.currentMonth} of {group.totalMonths}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="list-card-right">
                                        <button className="view-details-btn">View Details <ArrowRight size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {!loading && groups.length > 0 && pagination.totalPages > 1 && (
                    <div className="elder-pagination">
                        <button className="page-btn" disabled={pagination.currentPage === 1} onClick={() => handlePageChange(pagination.currentPage - 1)}><ChevronLeft size={24} /> Prev</button>
                        <span className="page-info">Page {pagination.currentPage} of {pagination.totalPages}</span>
                        <button className="page-btn" disabled={pagination.currentPage === pagination.totalPages} onClick={() => handlePageChange(pagination.currentPage + 1)}>Next <ChevronRight size={24} /></button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Groups;