import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, IndianRupee, Users, FileText, History, Gavel, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/userApi';
import logo from '../../assets/images/logo.png';
import './Dashboard.css';

const MemberDashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    // States
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pendingAmount: 0, receivableAmount: 0 });
    const [notifications, setNotifications] = useState(0);
    const [adData, setAdData] = useState({ text: null, link: null });

    // Pending Transactions State (NEW)
    const [pendingConfirmations, setPendingConfirmations] = useState([]);
    const [confirmingTxId, setConfirmingTxId] = useState(null);

    // Notification Modal States
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifList, setNotifList] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [viewAllMode, setViewAllMode] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const notifRef = useRef(null);

    // Live clock timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch all dashboard data concurrently
    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // ADDED: getTransactionHistory with status=PENDING
                const [statsRes, notifRes, adRes, pendingTxRes] = await Promise.allSettled([
                    userApi.getDashboardStats(),
                    userApi.getUnreadNotifications(),
                    userApi.getActiveAd(),
                    userApi.getTransactionHistory({ status: 'PENDING', limit: 10 })
                ]);

                if (statsRes.status === 'fulfilled' && statsRes.value.data.success) {
                    setStats(statsRes.value.data.data);
                }
                if (notifRes.status === 'fulfilled' && notifRes.value.data.success) {
                    setNotifications(notifRes.value.data.data.count);
                }
                if (adRes.status === 'fulfilled' && adRes.value.data.success && adRes.value.data.data) {
                    setAdData({
                        text: adRes.value.data.data.adText,
                        link: adRes.value.data.data.adLink
                    });
                }
                if (pendingTxRes.status === 'fulfilled' && pendingTxRes.value.data.success) {
                    setPendingConfirmations(pendingTxRes.value.data.data.transactions || []);
                }
            } catch (error) {
                console.error("Dashboard data fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Handle clicks outside the notification modal to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
                setViewAllMode(false); // Reset to default view when closed
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Action Handlers ---

    // NEW: Handle Transaction Confirmation
    const handleConfirmTransaction = async (txId) => {
        setConfirmingTxId(txId);
        try {
            const response = await userApi.confirmTransaction({ transactionId: txId });
            if (response.data.success) {
                // Remove the confirmed transaction from the UI immediately
                setPendingConfirmations(prev => prev.filter(tx => tx._id !== txId));
                alert("Transaction confirmed successfully!");
                // Optionally: re-fetch stats to update dashboard numbers
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Failed to confirm transaction.");
        } finally {
            setConfirmingTxId(null);
        }
    };

    const handleNotificationClick = async () => {
        const newOpenState = !isNotifOpen;
        setIsNotifOpen(newOpenState);

        // Fetch Recent Unread when opening
        if (newOpenState) {
            setViewAllMode(false);
            setLoadingNotifs(true);
            try {
                const response = await userApi.getNotificationsList(true, 5, 1);
                if (response.data.success) {
                    const fetchedNotifs = response.data.data.notifications;
                    setNotifList(fetchedNotifs);
                    setNotifications(prev => Math.max(0, prev - fetchedNotifs.length));
                }
            } catch (error) {
                console.error("Failed to fetch unread notifications", error);
            } finally {
                setLoadingNotifs(false);
            }
        }
    };

    const fetchAllNotifications = async (page = 1) => {
        setLoadingNotifs(true);
        setViewAllMode(true);
        try {
            const response = await userApi.getNotificationsList(false, 10, page);
            if (response.data.success) {
                setNotifList(response.data.data.notifications);
                setCurrentPage(response.data.data.pagination.page);
                setTotalPages(response.data.data.pagination.totalPages);
            }
        } catch (error) {
            console.error("Failed to fetch all notifications", error);
        } finally {
            setLoadingNotifs(false);
        }
    };

    const formatDateTime = (date) => {
        return date.toLocaleString('en-IN', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0,
        }).format(amount);
    };

    const displayAmount = stats.receivableAmount > 0 ? stats.receivableAmount : stats.pendingAmount;
    const amountLabel = stats.receivableAmount > 0 ? "Receivable Amount" : "Pending Contribution";
    const amountColor = stats.receivableAmount > 0 ? "#10b981" : "#ef4444";

    if (loading) {
        return (
            <div className="custom-dashboard-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading your dashboard...</p>
            </div>
        );
    }

    return (
        <div className="custom-dashboard-container">
            <header className="dashboard-header">
                <div className="header-left">
                    <span className="datetime-display">{formatDateTime(currentTime)}</span>
                </div>

                <div className="header-center">
                    <div className="logo-placeholder">
                        <img src={logo} alt="Logo" className="center-logo" />
                    </div>
                </div>

                <div className="header-right">
                    <div className="notification-wrapper" ref={notifRef}>
                        <button
                            className="icon-btn notification-btn"
                            onClick={handleNotificationClick}
                        >
                            <Bell size={26} />
                            {notifications > 0 && <span className="badge">{notifications}</span>}
                        </button>

                        {isNotifOpen && (
                            <div className={`notification-modal ${viewAllMode ? 'expanded' : ''}`}>
                                <div className="notif-header">
                                    <h4>{viewAllMode ? 'All Notifications' : 'Recent Notifications'}</h4>
                                    {notifications > 0 && !viewAllMode && <span className="notif-count">{notifications} New</span>}
                                </div>

                                <div className={`notif-body ${viewAllMode ? 'expanded-body' : ''}`}>
                                    {loadingNotifs ? (
                                        <div className="notif-empty">
                                            <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                                        </div>
                                    ) : notifList.length === 0 ? (
                                        <div className="notif-empty">
                                            <Bell size={32} className="empty-bell" />
                                            <p>{viewAllMode ? 'Inbox is empty' : 'No new messages'}</p>
                                        </div>
                                    ) : (
                                        <ul className="notif-list">
                                            {notifList.map((notif) => (
                                                <li key={notif._id} className={`notif-item ${!notif.isRead ? 'unread' : ''}`}>
                                                    <div className="notif-icon"><Bell size={16} /></div>
                                                    <div className="notif-content">
                                                        <p className="notif-title">{notif.title}</p>
                                                        <p className="notif-desc">{notif.body}</p>
                                                        <span className="notif-time">
                                                            {new Date(notif.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {!viewAllMode ? (
                                    <div className="notif-footer" onClick={() => fetchAllNotifications(1)}>
                                        View all notifications
                                    </div>
                                ) : (
                                    <div className="notif-pagination-footer">
                                        <button
                                            className="page-btn"
                                            disabled={currentPage === 1 || loadingNotifs}
                                            onClick={() => fetchAllNotifications(currentPage - 1)}
                                        >
                                            <ChevronLeft size={16} /> Prev
                                        </button>
                                        <span className="page-info">Page {currentPage} of {totalPages || 1}</span>
                                        <button
                                            className="page-btn"
                                            disabled={currentPage === totalPages || totalPages === 0 || loadingNotifs}
                                            onClick={() => fetchAllNotifications(currentPage + 1)}
                                        >
                                            Next <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="user-profile-section">
                        <span className="welcome-text">Welcome, {user?.name || 'User'}</span>
                        <button className="icon-btn logout-btn" onClick={logout} title="Logout">
                            <LogOut size={24} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="dashboard-main">

                {/* === NEW: PENDING CONFIRMATIONS SECTION === */}
                {pendingConfirmations.length > 0 && (
                    <div className="pending-actions-container">
                        <div className="pending-header">
                            <AlertCircle size={24} className="text-amber" />
                            <h2>Action Required: Pending Confirmations</h2>
                        </div>

                        <div className="pending-cards-wrapper">
                            {pendingConfirmations.map(tx => (
                                <div key={tx._id} className="pending-action-card">
                                    <div className="pending-action-info">
                                        <h4>Verify {tx.type === 'CONTRIBUTION' ? 'Collection' : 'Payout'}</h4>
                                        <p>
                                            Employee <strong>{tx.handledBy?.name || 'Agent'}</strong> is requesting confirmation for a
                                            transaction of <strong className={tx.type === 'CONTRIBUTION' ? 'text-blue' : 'text-emerald'}>{formatCurrency(tx.amount)}</strong> for
                                            group <strong>{tx.group?.name || 'Unknown'}</strong> (Month {tx.monthNumber}).
                                        </p>
                                    </div>
                                    <div className="pending-action-btns">
                                        <button
                                            className="btn-confirm-tx"
                                            onClick={() => handleConfirmTransaction(tx._id)}
                                            disabled={confirmingTxId === tx._id}
                                        >
                                            <CheckCircle size={18} /> {confirmingTxId === tx._id ? 'Confirming...' : 'Confirm'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* ========================================= */}

                <div className="cross-layout-grid">
                    <div className="layout-card card-amount" onClick={() => navigate('/user/transactions')}>
                        <div className="icon-wrapper"><IndianRupee size={40} /></div>
                        <p className="card-value" style={{ color: amountColor }}>
                            {formatCurrency(displayAmount)}
                        </p>
                        <span className="card-hint">{amountLabel}</span>
                    </div>

                    <div className="layout-card card-groups" onClick={() => navigate('/user/groups')}>
                        <div className="icon-wrapper"><Users size={40} /></div>
                        <h3>Groups</h3>
                        <span className="card-hint">View & Join</span>
                    </div>

                    <div className="layout-card card-request" onClick={() => navigate('/user/raise-request')}>
                        <div className="icon-wrapper"><FileText size={40} /></div>
                        <h3>Raise Request</h3>
                        <span className="card-hint">Collections & Payments</span>
                    </div>

                    <div className="layout-card card-passbook" onClick={() => navigate('/user/transactions')}>
                        <div className="icon-wrapper"><History size={40} /></div>
                        <h3>Passbook / History</h3>
                        <span className="card-hint">View Transactions</span>
                    </div>

                    <div className="layout-card card-bidding" onClick={() => navigate('/user/bidding')}>
                        <div className="icon-wrapper"><Gavel size={40} /></div>
                        <h3>Bidding</h3>
                        <span className="card-hint">Live & Upcoming</span>
                    </div>
                </div>
            </main>

            {adData.text && (
                <footer className="dashboard-footer">
                    <div className="marquee-container">
                        <a href={adData.link} target="_blank" rel="noopener noreferrer" className="marquee-content">
                            {adData.text}
                        </a>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default MemberDashboard;