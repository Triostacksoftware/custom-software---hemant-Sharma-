import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, BellRing, TrendingUp, CheckCircle, Filter, Trophy, ChevronLeft, ChevronRight, ChevronDown, XCircle } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Payouts.css';

const Payouts = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [payouts, setPayouts] = useState([]);
    const [summary, setSummary] = useState({ totalPendingPayoutAmount: 0, totalPendingWinners: 0 });
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [activeGroups, setActiveGroups] = useState([]);

    // UI States
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
    const [notifyingId, setNotifyingId] = useState(null);

    // Modal States
    const [confirmModal, setConfirmModal] = useState({ show: false, record: null, title: '', message: '' });
    const [infoModal, setInfoModal] = useState({ show: false, title: '', message: '', isError: false });

    // Fetch Groups for Filter
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

    // Fetch Pending Payouts
    const fetchPendingPayouts = useCallback(async (page = 1, search = '', groupId = '') => {
        setLoading(true);
        setError('');
        try {
            const params = { page, limit: 10, search };
            if (groupId) params.groupId = groupId;

            const response = await adminApi.payouts.getPending(params);

            if (response.data.success) {
                setPayouts(response.data.data.payouts);
                setSummary(response.data.data.summary);

                const pag = response.data.data.pagination;
                setPagination({
                    currentPage: pag.page,
                    totalPages: pag.totalPages,
                    total: pag.total
                });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load pending payouts.');
            setPayouts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingPayouts(1, searchQuery, selectedGroupId);
    }, [selectedGroupId, fetchPendingPayouts]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchPendingPayouts(1, searchQuery, selectedGroupId);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchPendingPayouts(newPage, searchQuery, selectedGroupId);
        }
    };

    // --- Modal Notification Flow ---
    const promptSendNotification = (record) => {
        setConfirmModal({
            show: true,
            record: record,
            title: 'Notify Winner?',
            message: `Are you sure you want to send a payout notification to ${record.winnerName} for the pending amount of ₹${record.pendingAmount}?`
        });
    };

    const executeNotification = async () => {
        const record = confirmModal.record;
        setConfirmModal({ show: false, record: null, title: '', message: '' });

        const uniqueId = `${record.groupId}_${record.winnerId}`;
        setNotifyingId(uniqueId);

        try {
            // Mock API Delay (Replace with actual API call when backend is ready)
            await new Promise(resolve => setTimeout(resolve, 800));

            setInfoModal({
                show: true,
                title: 'Notification Sent',
                message: `Push notification sent successfully to ${record.winnerName} to collect ₹${record.pendingAmount}.`,
                isError: false
            });
        } catch (err) {
            setInfoModal({
                show: true,
                title: 'Failed to Send',
                message: err.response?.data?.message || "Failed to send notification. Please try again.",
                isError: true
            });
        } finally {
            setNotifyingId(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

    const selectedGroupObj = activeGroups.find(g => g._id === selectedGroupId);

    return (
        <div className="admin-payouts-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Payout List</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="payouts-main-content">

                {/* Top Summary Stats */}
                <div className="payouts-stats-grid">
                    <div className="p-stat-card border-emerald">
                        <div className="p-stat-icon bg-emerald-light"><TrendingUp size={28} className="text-emerald" /></div>
                        <div className="p-stat-info">
                            <p>Total To Payout (This Month)</p>
                            <h3 className="text-emerald">{formatCurrency(summary.totalPendingPayoutAmount)}</h3>
                        </div>
                    </div>
                    <div className="p-stat-card border-gold">
                        <div className="p-stat-icon bg-gold-light"><Trophy size={28} className="text-gold" /></div>
                        <div className="p-stat-info">
                            <p>Pending Winners</p>
                            <h3 className="text-gold">{summary.totalPendingWinners} <span style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b' }}>members</span></h3>
                        </div>
                    </div>
                </div>

                {/* Control Panel (Search & Custom Filter) */}
                <div className="payouts-control-panel">
                    <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                        <div className="admin-search-input-wrapper">
                            <Search size={20} className="admin-search-icon" />
                            <input
                                type="text"
                                placeholder="Search winners by name or phone..."
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
                        <h2 className="elder-section-title">Outstanding Payouts</h2>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card">
                            <div className="spinner"></div>
                            <p className="loading-text">Loading pending payouts...</p>
                        </div>
                    ) : error ? (
                        <div className="elder-empty-card">
                            <p className="error-text">{error}</p>
                            <button className="elder-btn-primary" onClick={() => fetchPendingPayouts(1, searchQuery, selectedGroupId)}>Retry</button>
                        </div>
                    ) : payouts.length === 0 ? (
                        <div className="elder-empty-card">
                            <div className="empty-icon-wrapper bg-emerald-light">
                                <CheckCircle size={48} className="text-emerald" opacity={0.8} />
                            </div>
                            <h3 style={{ color: '#1e293b', margin: '0 0 0.5rem 0' }}>No Pending Payouts</h3>
                            <p>All current winners have received their full amounts.</p>
                        </div>
                    ) : (
                        <div className="compact-list-container">
                            {payouts.map((record) => {
                                const uniqueId = `${record.groupId}_${record.winnerId}`;
                                const isNotifying = notifyingId === uniqueId;

                                return (
                                    <div key={uniqueId} className="compact-pay-row">
                                        <div className="cp-left">
                                            <div className="cp-avatar bg-gold-light text-gold">
                                                <Trophy size={18} />
                                            </div>
                                            <div className="cp-info">
                                                <h4 className="cp-name" title={record.winnerName}>{record.winnerName}</h4>
                                                <div className="cp-meta">
                                                    <span>{record.winnerPhone || 'No phone'}</span>
                                                    <span className="cp-dot">•</span>
                                                    <span className="cp-group-text" title={record.groupName}>
                                                        {record.groupName} <span className="cp-month">(M{record.currentMonth})</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="cp-right">
                                            <div className="cp-financials">
                                                <span className="cp-pending text-emerald">{formatCurrency(record.pendingAmount)}</span>
                                                <span
                                                    className="cp-paid"
                                                    title={`Total Payout: ${formatCurrency(record.winnerReceivableAmount)} | Winning Bid: ${formatCurrency(record.winningBidAmount)} | Distributed: ${formatCurrency(record.alreadyReceived)}`}
                                                >
                                                    Total: {formatCurrency(record.winnerReceivableAmount)}
                                                </span>
                                            </div>
                                            <button
                                                className="cp-notify-btn"
                                                onClick={() => promptSendNotification(record)}
                                                disabled={isNotifying}
                                                title="Send Notification"
                                            >
                                                {isNotifying ? <span className="spinner-micro"></span> : <><BellRing size={16} /><span className="remind-txt">Notify</span></>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Pagination Controls */}
                {!loading && payouts.length > 0 && pagination.totalPages > 1 && (
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
                        <div className="confirm-icon-wrapper bg-emerald-light text-emerald">
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
                                className="elder-btn-primary btn-success-fill"
                                onClick={executeNotification}
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

export default Payouts;