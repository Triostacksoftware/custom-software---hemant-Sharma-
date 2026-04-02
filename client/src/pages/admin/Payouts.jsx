import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, BellRing, User, TrendingUp, CheckCircle, Filter, Trophy, IndianRupee } from 'lucide-react';
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

    // Action States
    const [notifyingId, setNotifyingId] = useState(null);

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

    const handleSendNotification = async (record) => {
        const uniqueId = `${record.groupId}_${record.winnerId}`;
        setNotifyingId(uniqueId);
        try {
            // Mock API Delay
            await new Promise(resolve => setTimeout(resolve, 800));
            alert(`Notification sent to winner ${record.winnerName}. Please arrange for payout of ₹${record.pendingAmount}`);
        } catch (err) {
            alert("Failed to send notification");
        } finally {
            setNotifyingId(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

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

                {/* Control Panel */}
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
                        <h2 className="elder-section-title">Outstanding Payouts</h2>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card">
                            <div className="spinner"></div>
                            <p>Loading pending payouts...</p>
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
                        <div className="elder-list-container">
                            {payouts.map((record) => {
                                const uniqueId = `${record.groupId}_${record.winnerId}`;
                                const isNotifying = notifyingId === uniqueId;

                                return (
                                    <div key={uniqueId} className="elder-list-card payout-card">
                                        <div className="pay-card-left">
                                            <div className="icon-wrapper icon-emerald"><Trophy size={24} /></div>
                                            <div className="pay-card-info">
                                                <h3 className="elder-card-title">{record.winnerName}</h3>
                                                <p className="pay-phone">{record.winnerPhone || 'No phone number'}</p>
                                                <div className="pay-group-badges">
                                                    <span className="pay-badge group-name-badge">{record.groupName}</span>
                                                    <span className="pay-badge month-badge">Month {record.currentMonth} Winner</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pay-card-right">
                                            <div className="pay-financials">
                                                <div className="pay-fin-detail">
                                                    <span>Total Payout:</span>
                                                    <strong>{formatCurrency(record.winnerReceivableAmount)}</strong>
                                                </div>
                                                <div className="pay-fin-detail">
                                                    <span>Winning Bid:</span>
                                                    <span className="bid-amount-text">{formatCurrency(record.winningBidAmount)}</span>
                                                </div>
                                                <div className="pay-fin-detail">
                                                    <span>Distributed:</span>
                                                    <strong className="text-blue">{formatCurrency(record.alreadyReceived)}</strong>
                                                </div>
                                                <div className="pay-fin-detail pending-detail">
                                                    <span>Pending:</span>
                                                    <strong className="text-emerald">{formatCurrency(record.pendingAmount)}</strong>
                                                </div>
                                            </div>

                                            <button
                                                className="elder-btn-success-solid notify-btn"
                                                onClick={() => handleSendNotification(record)}
                                                disabled={isNotifying}
                                            >
                                                {isNotifying ? 'Sending...' : <><BellRing size={18} /> Notify</>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default Payouts;