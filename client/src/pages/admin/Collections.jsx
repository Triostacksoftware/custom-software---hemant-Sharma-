import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, BellRing, User, TrendingDown, Users, CheckCircle, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Collections.css'; // We will create a specific CSS file for this

const Collections = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [collections, setCollections] = useState([]);
    const [summary, setSummary] = useState({ totalPendingAmount: 0, totalPendingMembers: 0 });
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [activeGroups, setActiveGroups] = useState([]); // For the dropdown filter

    // Action States
    const [remindingId, setRemindingId] = useState(null);

    // Fetch Active Groups for the Filter Dropdown
    useEffect(() => {
        const fetchGroupsForFilter = async () => {
            try {
                // Fetch up to 100 active groups just for the dropdown
                const res = await adminApi.groups.fetchAll({ status: 'ACTIVE', limit: 100 });
                if (res.data.success) {
                    setActiveGroups(res.data.data.groups);
                }
            } catch (err) {
                console.error("Failed to fetch groups for filter");
            }
        };
        fetchGroupsForFilter();
    }, []);

    // Fetch Pending Collections
    const fetchPendingCollections = useCallback(async (page = 1, search = '', groupId = '') => {
        setLoading(true);
        setError('');
        try {
            const params = { page, limit: 10, search };
            if (groupId) params.groupId = groupId;

            const response = await adminApi.collections.getPending(params);

            if (response.data.success) {
                setCollections(response.data.data.collections);
                setSummary(response.data.data.summary);

                // Map backend pagination to our frontend state format
                const pag = response.data.data.pagination;
                setPagination({
                    currentPage: pag.page,
                    totalPages: pag.totalPages,
                    total: pag.total
                });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load pending collections.');
            setCollections([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial Fetch & on Filter Change
    useEffect(() => {
        fetchPendingCollections(1, searchQuery, selectedGroupId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroupId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchPendingCollections(1, searchQuery, selectedGroupId);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchPendingCollections(newPage, searchQuery, selectedGroupId);
        }
    };

    // Mock Reminder Function
    const handleSendReminder = async (record) => {
        const uniqueId = `${record.groupId}_${record.memberId}`;
        setRemindingId(uniqueId);

        try {
            // TODO: In the future, this will call your actual notification API
            // await adminApi.notifications.sendReminder({ userId: record.memberId, groupId: record.groupId, amount: record.pendingAmount });

            // Simulating API delay
            await new Promise(resolve => setTimeout(resolve, 800));

            alert(`Reminder sent to ${record.memberName} for ₹${record.pendingAmount}`);
        } catch (err) {
            alert("Failed to send reminder");
        } finally {
            setRemindingId(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

    return (
        <div className="admin-collections-container">
            {/* Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Collection List</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="collections-main-content">

                {/* Top Summary Stats */}
                <div className="collections-stats-grid">
                    <div className="c-stat-card border-red">
                        <div className="c-stat-icon bg-red-light"><TrendingDown size={28} className="text-red" /></div>
                        <div className="c-stat-info">
                            <p>Total Outstanding (This Month)</p>
                            <h3 className="text-red">{formatCurrency(summary.totalPendingAmount)}</h3>
                        </div>
                    </div>
                    <div className="c-stat-card border-slate">
                        <div className="c-stat-icon bg-slate-light"><Users size={28} className="text-slate" /></div>
                        <div className="c-stat-info">
                            <p>Pending Contributions</p>
                            <h3 className="text-slate">{summary.totalPendingMembers} <span style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b' }}>records</span></h3>
                        </div>
                    </div>
                </div>

                {/* Control Panel (Search & Filter) */}
                <div className="collections-control-panel">
                    <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                        <div className="admin-search-input-wrapper">
                            <Search size={20} className="admin-search-icon" />
                            <input
                                type="text"
                                placeholder="Search by member name or phone..."
                                className="admin-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="admin-search-submit-btn">Search</button>
                    </form>

                    <div className="filter-wrapper">
                        <Filter size={18} className="filter-icon" />
                        <select
                            className="group-filter-select"
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                        >
                            <option value="">All Active Groups</option>
                            {activeGroups.map(g => (
                                <option key={g._id} value={g._id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* List Section */}
                <section className="elder-section">
                    <div className="section-header-flex">
                        <h2 className="elder-section-title">Pending Dues</h2>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card">
                            <div className="spinner"></div>
                            <p className="loading-text">Loading outstanding collections...</p>
                        </div>
                    ) : error ? (
                        <div className="elder-empty-card">
                            <p className="error-text">{error}</p>
                            <button className="elder-btn-primary" onClick={() => fetchPendingCollections(pagination.currentPage, searchQuery, selectedGroupId)}>Retry</button>
                        </div>
                    ) : collections.length === 0 ? (
                        <div className="elder-empty-card">
                            <div className="empty-icon-wrapper bg-green-light">
                                <CheckCircle size={48} className="text-green" opacity={0.8} />
                            </div>
                            <h3 style={{ color: '#1e293b', margin: '0 0 0.5rem 0' }}>All Clear!</h3>
                            <p>There are no pending collections for {selectedGroupId ? 'this group' : 'any active group'}.</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {collections.map((record) => {
                                const uniqueId = `${record.groupId}_${record.memberId}`;
                                const isReminding = remindingId === uniqueId;

                                return (
                                    <div key={uniqueId} className="elder-list-card collection-card">
                                        <div className="col-card-left">
                                            <div className="icon-wrapper icon-slate"><User size={26} /></div>
                                            <div className="col-card-info">
                                                <h3 className="elder-card-title">{record.memberName}</h3>
                                                <p className="col-phone">{record.memberPhone || 'No phone number'}</p>
                                                <div className="col-group-badges">
                                                    <span className="col-badge group-name-badge">{record.groupName}</span>
                                                    <span className="col-badge month-badge">Month {record.currentMonth}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-card-right">
                                            <div className="col-financials">
                                                <div className="fin-detail">
                                                    <span>Payable:</span>
                                                    <strong>{formatCurrency(record.payableAmount)}</strong>
                                                </div>
                                                <div className="fin-detail">
                                                    <span>Paid:</span>
                                                    <strong className="text-green">{formatCurrency(record.alreadyPaid)}</strong>
                                                </div>
                                                <div className="fin-detail pending-detail">
                                                    <span>Pending:</span>
                                                    <strong className="text-red">{formatCurrency(record.pendingAmount)}</strong>
                                                </div>
                                            </div>

                                            <button
                                                className="elder-btn-primary remind-btn"
                                                onClick={() => handleSendReminder(record)}
                                                disabled={isReminding || !record.memberPhone}
                                                title={!record.memberPhone ? "Cannot send reminder without a phone number" : ""}
                                            >
                                                {isReminding ? 'Sending...' : <><BellRing size={18} /> Remind</>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Pagination Controls */}
                {!loading && collections.length > 0 && pagination.totalPages > 1 && (
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

export default Collections;