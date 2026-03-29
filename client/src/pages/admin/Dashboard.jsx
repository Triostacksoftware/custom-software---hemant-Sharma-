import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, LogOut, IndianRupee, Users, Folder, TrendingUp, TrendingDown,
    Calendar, Sun, CheckSquare, Megaphone, Gavel, Briefcase, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { adminApi } from '../../api/adminApi';
import logo from '../../assets/images/logo.png';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);

    // Notification Modal States
    const [notifications, setNotifications] = useState(0); // Unread count
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

    // Fetch Dashboard Stats & Unread Notifications
    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                // Fetch unread notifications count
                adminApi.getUnreadNotifications()
                    .then(res => {
                        if (res.data.success) setNotifications(res.data.data.count);
                    })
                    .catch(err => console.error("Failed to load notifications", err));

                // Fetch Actual Dashboard Data from Backend
                const response = await adminApi.getDashboardStats();
                if (response.data.success) {
                    const data = response.data.data;

                    // Calculate total pending approvals (Members + Employees)
                    const totalPendingApprovals = (data.users?.pending || 0) + (data.employees?.pending || 0);

                    setDashboardData({
                        stats: data.stats,
                        actionBadges: {
                            ...data.actionBadges,
                            pendingApprovals: totalPendingApprovals
                        }
                    });
                }
            } catch (error) {
                console.error("Failed to load admin dashboard", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
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

    const handleNotificationClick = async () => {
        const newOpenState = !isNotifOpen;
        setIsNotifOpen(newOpenState);

        // Fetch Recent Unread when opening
        if (newOpenState) {
            setViewAllMode(false);
            setLoadingNotifs(true);
            try {
                const response = await adminApi.getNotificationsList(true, 5, 1);
                if (response.data.success) {
                    const fetchedNotifs = response.data.data.notifications;
                    setNotifList(fetchedNotifs);

                    // Backend marks these as read, so decrement our local unread badge count
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
            // Fetch all notifications (unreadOnly = false), 10 per page
            const response = await adminApi.getNotificationsList(false, 10, page);
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

    if (loading) {
        return (
            <div className="admin-dashboard-container center-content">
                <div className="spinner"></div>
                <p className="loading-text">Loading Admin Workspace...</p>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="admin-dashboard-container center-content">
                <p className="error-text">Failed to load dashboard statistics.</p>
                <button className="elder-btn-primary" onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    const { stats, actionBadges } = dashboardData;

    return (
        <div className="admin-dashboard-container">
            {/* Header */}
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

                    {/* Notification Wrapper */}
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

                                {/* Dynamic Footer */}
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
                        <span className="welcome-text">Admin: {user?.name || 'Administrator'}</span>
                        <button className="icon-btn logout-btn" onClick={logout} title="Logout">
                            <LogOut size={24} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="admin-main-content">
                {/* TOP SECTION: Statistics Cards */}
                <h2 className="section-heading">Overview & Statistics</h2>
                <div className="admin-stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon icon-slate"><Folder size={24} /></div>
                        <div className="stat-info">
                            <p className="stat-title">Total Groups</p>
                            <h3 className="stat-value">{stats.totalGroups}</h3>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon icon-slate"><Users size={24} /></div>
                        <div className="stat-info">
                            <p className="stat-title">Total Members</p>
                            <h3 className="stat-value">{stats.totalMembers}</h3>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon icon-rose"><TrendingDown size={24} /></div>
                        <div className="stat-info">
                            <p className="stat-title">Pending Collection (Month)</p>
                            <h3 className="stat-value text-rose">{formatCurrency(stats.pendingCollectionThisMonth)}</h3>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon icon-emerald"><TrendingUp size={24} /></div>
                        <div className="stat-info">
                            <p className="stat-title">Pending Payout (Month)</p>
                            <h3 className="stat-value text-emerald">{formatCurrency(stats.pendingPayoutThisMonth)}</h3>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon icon-navy"><Sun size={24} /></div>
                        <div className="stat-info">
                            <p className="stat-title">Today's Collection</p>
                            <h3 className="stat-value">{formatCurrency(stats.todaysCollection)}</h3>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon icon-navy"><Calendar size={24} /></div>
                        <div className="stat-info">
                            <p className="stat-title">This Month's Collection</p>
                            <h3 className="stat-value">{formatCurrency(stats.thisMonthsCollection)}</h3>
                        </div>
                    </div>
                </div>

                <hr className="admin-divider" />

                {/* BOTTOM SECTION: Navigation / Action Cards */}
                <h2 className="section-heading">Management Hub</h2>
                <div className="admin-actions-grid">

                    <div className="action-card" onClick={() => navigate('/admin/collections')}>
                        <div className="action-icon-wrapper icon-rose"><TrendingDown size={32} /></div>
                        <div className="action-content">
                            <h3>Collection List</h3>
                            <p>View pending dues and send payment reminders to members.</p>
                        </div>
                        {actionBadges.membersToCollectFrom > 0 && (
                            <div className="action-smart-badge badge-rose">{actionBadges.membersToCollectFrom} Due</div>
                        )}
                    </div>

                    <div className="action-card" onClick={() => navigate('/admin/payouts')}>
                        <div className="action-icon-wrapper icon-emerald"><TrendingUp size={32} /></div>
                        <div className="action-content">
                            <h3>Payout List</h3>
                            <p>Manage and process winning payouts across all active groups.</p>
                        </div>
                        {actionBadges.membersToPay > 0 && (
                            <div className="action-smart-badge badge-emerald">{actionBadges.membersToPay} Pending</div>
                        )}
                    </div>

                    <div className="action-card" onClick={() => navigate('/admin/bidding')}>
                        <div className="action-icon-wrapper icon-navy"><Gavel size={32} /></div>
                        <div className="action-content">
                            <h3>Bidding Hub</h3>
                            <p>Start bidding rounds, monitor live rooms, and declare winners.</p>
                        </div>
                        {actionBadges.liveBiddingRooms > 0 && (
                            <div className="action-smart-badge badge-navy">{actionBadges.liveBiddingRooms} Live</div>
                        )}
                    </div>

                    <div className="action-card" onClick={() => navigate('/admin/members')}>
                        <div className="action-icon-wrapper icon-slate"><Users size={32} /></div>
                        <div className="action-content">
                            <h3>Members Directory</h3>
                            <p>Search, filter, and view details for all registered members.</p>
                        </div>
                    </div>

                    <div className="action-card" onClick={() => navigate('/admin/groups')}>
                        <div className="action-icon-wrapper icon-slate"><Folder size={32} /></div>
                        <div className="action-content">
                            <h3>Groups Management</h3>
                            <p>Manage existing groups, view histories, or create new ones.</p>
                        </div>
                    </div>

                    <div className="action-card" onClick={() => navigate('/admin/approvals')}>
                        <div className="action-icon-wrapper icon-slate"><CheckSquare size={32} /></div>
                        <div className="action-content">
                            <h3>Approvals</h3>
                            <p>Review and approve new member and employee registrations.</p>
                        </div>
                        {actionBadges.pendingApprovals > 0 && (
                            <div className="action-smart-badge badge-slate">{actionBadges.pendingApprovals} New</div>
                        )}
                    </div>

                    <div className="action-card" onClick={() => navigate('/admin/employees')}>
                        <div className="action-icon-wrapper icon-slate"><Briefcase size={32} /></div>
                        <div className="action-content">
                            <h3>Employee Directory</h3>
                            <p>View active agents, their assigned collections, and total payouts.</p>
                        </div>
                    </div>

                    <div className="action-card" onClick={() => navigate('/admin/advertisement')}>
                        <div className="action-icon-wrapper icon-slate"><Megaphone size={32} /></div>
                        <div className="action-content">
                            <h3>Advertisement</h3>
                            <p>Update the scrolling marquee text displayed on member dashboards.</p>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default Dashboard;