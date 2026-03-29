import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, User, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Members.css';

const Members = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [members, setMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

    const fetchMembers = useCallback(async (page = 1, search = '') => {
        setLoading(true);
        setError('');
        try {
            const response = await adminApi.users.fetchAll({ page, limit: 10, search });
            if (response.data.success) {
                setMembers(response.data.data.members);
                setPagination(response.data.data.pagination);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load members.');
            setMembers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMembers(1, searchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchMembers(1, searchQuery);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchMembers(newPage, searchQuery);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    };

    return (
        <div className="admin-members-container">
            {/* Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Members Directory</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="members-main-content">

                {/* Search Bar */}
                <div className="members-control-panel">
                    <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                        <div className="admin-search-input-wrapper">
                            <Search size={20} className="admin-search-icon" />
                            <input
                                type="text"
                                placeholder="Search members by name or phone..."
                                className="admin-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="admin-search-submit-btn">Search</button>
                    </form>
                </div>

                {/* List Section */}
                <section className="elder-section">
                    <div className="section-header-flex">
                        <h2 className="elder-section-title">Registered Members</h2>
                        <span className="total-count-badge">{pagination.total} Total</span>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card">
                            <div className="spinner"></div>
                            <p className="loading-text">Loading directory...</p>
                        </div>
                    ) : error ? (
                        <div className="elder-empty-card">
                            <p className="error-text">{error}</p>
                            <button className="elder-btn-primary" onClick={() => fetchMembers(pagination.currentPage, searchQuery)}>Retry</button>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="elder-empty-card">
                            <div className="empty-icon-wrapper icon-slate">
                                <User size={48} opacity={0.5} />
                            </div>
                            <p>No members found.</p>
                            {searchQuery && <p className="sub-empty-text">Try clearing your search filter.</p>}
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {members.map((member) => (
                                <div
                                    key={member._id}
                                    className="elder-list-card clickable-card"
                                    onClick={() => navigate(`/admin/member/${member._id}`)}
                                >
                                    <div className="list-card-left">
                                        <div className="icon-wrapper icon-slate">
                                            <User size={26} />
                                        </div>
                                        <div className="list-card-info">
                                            <div className="title-with-status">
                                                <h3 className="elder-card-title">{member.name}</h3>
                                                <span className={`status-badge ${member.approvalStatus === 'APPROVED' ? 'badge-success' : member.approvalStatus === 'PENDING' ? 'badge-warning' : 'badge-error'}`}>
                                                    {member.approvalStatus}
                                                </span>
                                            </div>
                                            <div className="person-details-inline">
                                                <span className="detail-text">{member.phoneNumber || member.phone || 'No phone'}</span>
                                                <span className="stat-divider">•</span>
                                                <span className="detail-text">Joined: {formatDate(member.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="list-card-right">
                                        <button className="view-details-btn">
                                            View Details <ArrowRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Pagination Controls */}
                {!loading && members.length > 0 && pagination.totalPages > 1 && (
                    <div className="elder-pagination">
                        <button
                            className="page-btn"
                            disabled={pagination.currentPage === 1}
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                        >
                            <ChevronLeft size={24} /> Prev
                        </button>
                        <span className="page-info">
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                        <button
                            className="page-btn"
                            disabled={pagination.currentPage === pagination.totalPages}
                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                        >
                            Next <ChevronRight size={24} />
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Members;