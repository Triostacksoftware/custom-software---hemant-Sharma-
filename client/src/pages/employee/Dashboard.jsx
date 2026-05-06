import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { employeeApi } from '../../api/employeeApi';
import BellNotification from '../../components/common/BellNotification';
import { LogOut, IndianRupee, TrendingDown, TrendingUp, Send, Filter, History, Clock, Wallet, ArrowRight, ChevronDown, CheckCircle } from 'lucide-react';
import logo from '../../assets/images/logo.png';
import './Dashboard.css';

const EmployeeDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);

    // Dashboard Data
    const [stats, setStats] = useState(null);
    const [activeGroups, setActiveGroups] = useState([]);

    // List States
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [pendingCollections, setPendingCollections] = useState([]);
    const [pendingPayouts, setPendingPayouts] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    // Custom Dropdown State
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

    // History States
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Modal States
    const [actionModal, setActionModal] = useState({ show: false, record: null });
    const [paymentMode, setPaymentMode] = useState('CASH');
    const [customAmount, setCustomAmount] = useState('');
    const [actionProcessing, setActionProcessing] = useState(false);

    // NEW: Success Modal State
    const [successModal, setSuccessModal] = useState({ show: false, message: '' });

    // --- Timers & Initial Loads ---
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [dashRes, groupsRes] = await Promise.all([
                    employeeApi.getDashboard(),
                    employeeApi.getActiveGroups()
                ]);

                if (dashRes.data.success) setStats(dashRes.data.data?.stats || dashRes.data.dashboard?.stats);
                if (groupsRes.data.success) {
                    setActiveGroups(groupsRes.data.groups);
                    if (groupsRes.data.groups.length > 0) {
                        setSelectedGroupId(groupsRes.data.groups[0]._id);
                    }
                }
            } catch (err) {
                console.error("Failed to load employee dashboard");
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
        fetchHistory(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Dynamic List Fetching ---
    const fetchPendingLists = useCallback(async (groupId) => {
        if (!groupId) return;
        setListLoading(true);
        try {
            const res = await employeeApi.getPendingMembers(groupId);
            if (res.data.success) {
                setPendingCollections(res.data.data.pendingCollection || []);
                setPendingPayouts(res.data.data.pendingPayout || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingLists(selectedGroupId);
    }, [selectedGroupId, fetchPendingLists]);

    // --- History Fetching ---
    const fetchHistory = async (page) => {
        setHistoryLoading(true);
        try {
            const res = await employeeApi.getTransactionHistory({ page, limit: 10 });
            if (res.data.success) {
                setHistory(res.data.data.transactions);
            }
        } catch (err) {
            console.error("Failed to load history");
        } finally {
            setHistoryLoading(false);
        }
    };

    // --- Transaction Actions ---
    const openActionModal = (record, type) => {
        setPaymentMode('CASH');
        setCustomAmount(record.remainingAmount);
        setActionModal({ show: true, record: { ...record, type } });
    };

    const handleInitiateTransaction = async (e) => {
        e.preventDefault();

        if (Number(customAmount) > actionModal.record.remainingAmount) {
            alert(`Amount cannot exceed the remaining balance of ₹${actionModal.record.remainingAmount}`);
            return;
        }

        setActionProcessing(true);
        const { record } = actionModal;

        try {
            const groupMatch = activeGroups.find(g => g._id === selectedGroupId);
            const payload = {
                groupId: selectedGroupId,
                userId: record.memberId,
                monthNumber: record.currentMonth || groupMatch?.currentMonth,
                amount: Number(customAmount),
                paymentMode: paymentMode,
                type: record.type,
                remarks: `Initiated by employee`
            };

            await employeeApi.initiateTransaction(payload);

            // Close action modal and show sleek success modal instead of alert
            setActionModal({ show: false, record: null });
            setSuccessModal({ show: true, message: "Request sent to member's app! Waiting for their confirmation." });

            fetchPendingLists(selectedGroupId);
            fetchHistory(1);

        } catch (err) {
            alert(err.response?.data?.message || 'Failed to initiate transaction');
        } finally {
            setActionProcessing(false);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    const selectedGroupObj = activeGroups.find(g => g._id === selectedGroupId);

    if (loading) return <div className="emp-dash-wrapper center-content"><div className="spinner"></div></div>;

    return (
        <div className="emp-dash-wrapper">
            {/* Header */}
            <header className="emp-header">
                <div className="header-left">
                    <span className="datetime-display">{currentTime.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="header-center">
                    <img src={logo} alt="Logo" className="center-logo" style={{ height: '40px' }} />
                </div>
                <div className="header-right">
                    <BellNotification api={employeeApi} />
                    <div className="user-profile-section">
                        <span className="welcome-text">Agent: {user?.name || 'Employee'}</span>
                        <button className="icon-btn logout-btn" onClick={logout} title="Logout"><LogOut size={22} /></button>
                    </div>
                </div>
            </header>

            <main className="emp-main-content">
                {/* Stat Cards */}
                <div className="emp-stats-grid">
                    <div className="emp-stat-card border-red">
                        <div className="stat-icon bg-red-light"><TrendingDown size={24} className="text-red" /></div>
                        <div className="stat-info">
                            <p>Total Pending Collection</p>
                            <h3 className="text-red">{formatCurrency(stats?.totalPendingCollectionThisMonth)}</h3>
                        </div>
                    </div>
                    <div className="emp-stat-card border-emerald">
                        <div className="stat-icon bg-emerald-light"><TrendingUp size={24} className="text-emerald" /></div>
                        <div className="stat-info">
                            <p>Total Pending Payout</p>
                            <h3 className="text-emerald">{formatCurrency(stats?.totalPendingPayoutThisMonth)}</h3>
                        </div>
                    </div>
                    <div className="emp-stat-card border-blue">
                        <div className="stat-icon bg-blue-light"><IndianRupee size={24} className="text-blue" /></div>
                        <div className="stat-info">
                            <p>Today's Collection</p>
                            <h3 className="text-blue">{formatCurrency(stats?.todaysCollection)}</h3>
                        </div>
                    </div>
                    <div className="emp-stat-card border-slate">
                        <div className="stat-icon bg-slate-light"><History size={24} className="text-slate" /></div>
                        <div className="stat-info">
                            <p>This Month's Collection</p>
                            <h3 className="text-slate">{formatCurrency(stats?.thisMonthsCollection)}</h3>
                        </div>
                    </div>
                </div>

                {/* === CUSTOM GROUP FILTER DROPDOWN === */}
                <div className="emp-filter-bar">
                    <Filter size={20} className="text-slate" />
                    <div className="custom-dropdown-container" style={{ width: '300px', maxWidth: '100%', marginLeft: '0.5rem' }}>
                        <div
                            className={`custom-dropdown-trigger filter-trigger ${groupDropdownOpen ? 'open' : ''}`}
                            onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                        >
                            {selectedGroupObj ? (
                                <div className="selected-emp-display">
                                    <span className="selected-emp-name">
                                        {selectedGroupObj.name} <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>(Month {selectedGroupObj.currentMonth})</span>
                                    </span>
                                </div>
                            ) : (
                                <span className="placeholder-text">-- Select Active Group --</span>
                            )}
                            <ChevronDown size={18} className={`dropdown-arrow ${groupDropdownOpen ? 'rotated' : ''}`} />
                        </div>

                        {groupDropdownOpen && (
                            <div className="custom-dropdown-menu">
                                {activeGroups.length === 0 ? (
                                    <div className="dropdown-empty">No active groups available.</div>
                                ) : (
                                    activeGroups.map(g => (
                                        <div
                                            key={g._id}
                                            className={`custom-dropdown-item ${selectedGroupId === g._id ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedGroupId(g._id);
                                                setGroupDropdownOpen(false);
                                            }}
                                        >
                                            <div className="emp-drop-info">
                                                <h4>{g.name}</h4>
                                                <span>Month {g.currentMonth}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lists Grid (Compact Design) */}
                <div className="emp-lists-grid">

                    {/* Collection List */}
                    <div className="emp-list-container">
                        <div className="list-header">
                            <h3>Collection List</h3>
                            <span className="badge-count bg-red-light text-red">{pendingCollections.length} Pending</span>
                        </div>
                        <div className="list-body">
                            {listLoading ? <div className="spinner small-spinner"></div> : pendingCollections.length === 0 ? (
                                <p className="empty-text">All collections complete for this group.</p>
                            ) : pendingCollections.map(member => (
                                <div key={member.memberId} className="compact-task-row">
                                    <div className="task-info-compact">
                                        <span className="member-name-compact">{member.memberName}</span>
                                        <span className="task-meta-compact text-red">Pending: {formatCurrency(member.remainingAmount)}</span>
                                    </div>
                                    <div className="task-actions-compact">
                                        {member.pendingConfirmations?.length > 0 ? (
                                            <button className="compact-action-btn compact-btn-waiting" disabled>
                                                <Clock size={14} /> Wait
                                            </button>
                                        ) : (
                                            <button className="compact-action-btn compact-btn-initiate" onClick={() => openActionModal(member, 'CONTRIBUTION')}>
                                                <Send size={14} /> Request
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payout List */}
                    <div className="emp-list-container">
                        <div className="list-header">
                            <h3>Payout List</h3>
                            <span className="badge-count bg-emerald-light text-emerald">{pendingPayouts.length} Pending</span>
                        </div>
                        <div className="list-body">
                            {listLoading ? <div className="spinner small-spinner"></div> : pendingPayouts.length === 0 ? (
                                <p className="empty-text">No pending payouts for this group.</p>
                            ) : pendingPayouts.map(winner => (
                                <div key={winner.memberId} className="compact-task-row payout-row">
                                    <div className="task-info-compact">
                                        <span className="member-name-compact">{winner.memberName} 👑</span>
                                        <span className="task-meta-compact text-emerald">Owed: {formatCurrency(winner.remainingAmount)}</span>
                                    </div>
                                    <div className="task-actions-compact">
                                        {winner.pendingConfirmations?.length > 0 ? (
                                            <button className="compact-action-btn compact-btn-waiting" disabled>
                                                <Clock size={14} /> Wait
                                            </button>
                                        ) : (
                                            <button className="compact-action-btn compact-btn-payout" onClick={() => openActionModal(winner, 'WINNER_PAYOUT')}>
                                                <Send size={14} /> Initiate
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* === WALLET BANNER === */}
                <div className="emp-wallet-banner" onClick={() => navigate('/employee/cash-transfers')}>
                    <div className="wallet-banner-left">
                        <div className="wallet-banner-icon">
                            <Wallet size={32} />
                        </div>
                        <div className="wallet-banner-info">
                            <h2>Cash Management Hub</h2>
                            <p>Transfer physical cash to other employees or confirm received funds.</p>
                        </div>
                    </div>
                    <button className="wallet-banner-btn">
                        Open Wallet <ArrowRight size={18} />
                    </button>
                </div>

                {/* Transaction History Table */}
                <div className="emp-history-section">
                    <h3>Your Transaction Log</h3>
                    <div className="table-responsive">
                        <table className="emp-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Member</th>
                                    <th>Group</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyLoading ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center' }}><div className="spinner small-spinner"></div></td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8' }}>No transactions logged yet.</td></tr>
                                ) : history.map(tx => (
                                    <tr key={tx._id}>
                                        <td>{new Date(tx.handledAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                        <td><span className={`type-badge ${tx.type === 'CONTRIBUTION' ? 'bg-blue-light text-blue' : 'bg-emerald-light text-emerald'}`}>{tx.type}</span></td>
                                        <td>{tx.userId?.name}</td>
                                        <td>{tx.groupId?.name}</td>
                                        <td style={{ fontWeight: '700' }}>{formatCurrency(tx.amount)}</td>
                                        <td>
                                            <span className={`status-badge ${tx.status === 'COMPLETED' ? 'bg-green-light text-green' : tx.status === 'PENDING' ? 'bg-yellow-light text-yellow' : 'bg-slate-light text-slate'}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Action Modal */}
            {actionModal.show && (
                <div className="emp-modal-overlay">
                    <div className="emp-modal-card">
                        <h3>Initiate Transaction</h3>
                        <p style={{ marginBottom: '1rem', color: '#64748b' }}>Send a payment request to the member's dashboard.</p>

                        <div className="modal-info-box">
                            <p><strong>Member:</strong> {actionModal.record?.memberName}</p>
                            <p><strong>Total Pending:</strong> {formatCurrency(actionModal.record?.remainingAmount)}</p>
                            <p><strong>Type:</strong> {actionModal.record?.type === 'CONTRIBUTION' ? 'Collection' : 'Payout'}</p>
                        </div>

                        <form onSubmit={handleInitiateTransaction} style={{ marginTop: '1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>
                                    Amount to Process (₹)
                                </label>
                                <input
                                    type="number"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    className="emp-select-input"
                                    min="1"
                                    max={actionModal.record?.remainingAmount}
                                    required
                                />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                                    You can process a partial amount. Max allowed: {formatCurrency(actionModal.record?.remainingAmount)}
                                </p>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>Payment Mode</label>
                                <select
                                    value={paymentMode}
                                    onChange={(e) => setPaymentMode(e.target.value)}
                                    className="emp-select-input"
                                    required
                                >
                                    <option value="CASH">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="INTERNET_BANKING">Internet Banking</option>
                                    <option value="CHEQUE">Cheque</option>
                                </select>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '2rem' }}>
                                <button type="button" className="emp-btn-secondary" onClick={() => setActionModal({ show: false, record: null })}>Cancel</button>
                                <button type="submit" className="emp-btn-primary" disabled={actionProcessing}>
                                    {actionProcessing ? 'Sending...' : 'Send Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Success Popup Modal */}
            {successModal.show && (
                <div className="emp-modal-overlay">
                    <div className="emp-modal-card confirm-dialog-card">
                        <div className="confirm-icon-wrapper bg-emerald-light text-emerald">
                            <CheckCircle size={36} />
                        </div>
                        <h3>Success!</h3>
                        <p>{successModal.message}</p>

                        <div className="modal-actions" style={{ marginTop: '1.5rem', width: '100%' }}>
                            <button
                                type="button"
                                className="emp-btn-primary btn-success-fill"
                                onClick={() => setSuccessModal({ show: false, message: '' })}
                                style={{ width: '100%' }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboard;