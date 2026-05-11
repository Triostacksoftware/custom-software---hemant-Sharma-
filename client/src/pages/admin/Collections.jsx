import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, BellRing, User, TrendingDown, Users, CheckCircle, Filter, ChevronLeft, ChevronRight, ChevronDown, XCircle } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Collections.css';

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
    const [activeGroups, setActiveGroups] = useState([]);

    // UI States
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
    const [remindingId, setRemindingId] = useState(null);

    // Modal States
    const [confirmModal, setConfirmModal] = useState({ show: false, record: null, title: '', message: '' });
    const [infoModal, setInfoModal] = useState({ show: false, title: '', message: '', isError: false });

    // Fetch Active Groups for the Filter Dropdown
    useEffect(() => {
        const fetchGroupsForFilter = async () => {
            try {
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

    // --- Modal Reminder Flow ---
    const promptSendReminder = (record) => {
        setConfirmModal({
            show: true,
            record: record,
            title: 'Send Reminder?',
            message: `Are you sure you want to send a payment reminder to ${record.memberName} for the pending amount of ₹${record.pendingAmount}?`
        });
    };

    const executeReminder = async () => {
        const record = confirmModal.record;
        setConfirmModal({ show: false, record: null, title: '', message: '' });

        const uniqueId = `${record.groupId}_${record.memberId}`;
        setRemindingId(uniqueId);

        try {
            const response = await adminApi.collections.sendReminder({
                userId: record.memberId,
                groupId: record.groupId,
                amount: record.pendingAmount
            });

            if (response.data.success) {
                setInfoModal({
                    show: true,
                    title: 'Reminder Sent',
                    message: `Push notification reminder sent successfully to ${record.memberName}.`,
                    isError: false
                });
            }
        } catch (err) {
            setInfoModal({
                show: true,
                title: 'Failed to Send',
                message: err.response?.data?.message || "Failed to send reminder. Please try again.",
                isError: true
            });
        } finally {
            setRemindingId(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

    const selectedGroupObj = activeGroups.find(g => g._id === selectedGroupId);

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

                {/* Control Panel (Search & Custom Filter) */}
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
                        <Filter size={20} className="filter-icon" />
                        <div className="custom-dropdown-container">
                            <div
                                className={`custom-dropdown-trigger filter-trigger ${groupDropdownOpen ? 'open' : ''}`}
                                onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                            >
                                <span className={selectedGroupId ? "selected-emp-name" : "placeholder-text"}>
                                    {selectedGroupObj ? selectedGroupObj.name : "All Active Groups"}
                                </span>
                                <ChevronDown size={18} className={`dropdown-arrow ${groupDropdownOpen ? 'rotated' : ''}`} />
                            </div>

                            {groupDropdownOpen && (
                                <div className="custom-dropdown-menu">
                                    <div
                                        className={`custom-dropdown-item ${!selectedGroupId ? 'selected' : ''}`}
                                        onClick={() => { setSelectedGroupId(''); setGroupDropdownOpen(false); }}
                                    >
                                        <div className="emp-drop-info">
                                            <h4>All Active Groups</h4>
                                        </div>
                                    </div>
                                    {activeGroups.map(g => (
                                        <div
                                            key={g._id}
                                            className={`custom-dropdown-item ${selectedGroupId === g._id ? 'selected' : ''}`}
                                            onClick={() => { setSelectedGroupId(g._id); setGroupDropdownOpen(false); }}
                                        >
                                            <div className="emp-drop-info">
                                                <h4>{g.name}</h4>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
                        <div className="compact-list-container">
                            {collections.map((record) => {
                                const uniqueId = `${record.groupId}_${record.memberId}`;
                                const isReminding = remindingId === uniqueId;

                                return (
                                    <div key={uniqueId} className="compact-col-row">
                                        <div className="cc-left">
                                            <div className="cc-avatar bg-slate-light text-slate">
                                                <User size={18} />
                                            </div>
                                            <div className="cc-info">
                                                <h4 className="cc-name" title={record.memberName}>{record.memberName}</h4>
                                                <div className="cc-meta">
                                                    <span>{record.memberPhone || 'No phone'}</span>
                                                    <span className="cc-dot">•</span>
                                                    <span className="cc-group-text" title={record.groupName}>
                                                        {record.groupName} <span className="cc-month">(M{record.currentMonth})</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="cc-right">
                                            <div className="cc-financials">
                                                <span className="cc-pending text-red">{formatCurrency(record.pendingAmount)}</span>
                                                <span className="cc-paid" title={`Total Payable: ${formatCurrency(record.payableAmount)}`}>
                                                    Paid {formatCurrency(record.alreadyPaid)}
                                                </span>
                                            </div>
                                            <button
                                                className="cc-remind-btn"
                                                onClick={() => promptSendReminder(record)}
                                                disabled={isReminding || !record.memberPhone}
                                                title={!record.memberPhone ? "Cannot send reminder without a phone number" : "Send Reminder"}
                                            >
                                                {isReminding ? <span className="spinner-micro"></span> : <><BellRing size={16} /><span className="remind-txt">Remind</span></>}
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

            {/* --- 1. Custom Confirmation Modal --- */}
            {confirmModal.show && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-card confirm-dialog-card">
                        <div className="confirm-icon-wrapper bg-blue-light text-blue">
                            <BellRing size={36} />
                        </div>
                        <h3>{confirmModal.title}</h3>
                        <p>{confirmModal.message}</p>

                        <div className="modal-actions" style={{ marginTop: '1.5rem', width: '100%' }}>
                            <button
                                className="elder-btn-secondary"
                                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                            >
                                Cancel
                            </button>
                            <button
                                className="elder-btn-primary btn-primary-fill"
                                onClick={executeReminder}
                            >
                                Yes, Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 2. Custom Success/Error Info Modal --- */}
            {infoModal.show && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-card confirm-dialog-card">
                        <div className={`confirm-icon-wrapper ${infoModal.isError ? 'bg-red-light text-red' : 'bg-emerald-light text-emerald'}`}>
                            {infoModal.isError ? <XCircle size={36} /> : <CheckCircle size={36} />}
                        </div>
                        <h3>{infoModal.title}</h3>
                        <p>{infoModal.message}</p>

                        <div className="modal-actions" style={{ marginTop: '1.5rem', width: '100%' }}>
                            <button
                                className={`elder-btn-primary full-width ${infoModal.isError ? 'btn-danger-fill' : 'btn-success-fill'}`}
                                onClick={() => setInfoModal({ ...infoModal, show: false })}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Collections;