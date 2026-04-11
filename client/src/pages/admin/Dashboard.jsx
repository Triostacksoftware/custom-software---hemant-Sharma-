import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, IndianRupee, Users, Folder, TrendingUp, TrendingDown,
    Calendar, Sun, CheckSquare, Megaphone, Gavel, Briefcase
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { adminApi } from '../../api/adminApi';
import BellNotification from '../../components/common/BellNotification'; // <-- NEW IMPORT
import logo from '../../assets/images/logo.png';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);

    // Live clock timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Dashboard Stats
    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                // Fetch Actual Dashboard Data from Backend
                const response = await adminApi.getDashboardStats();
                if (response.data.success) {
                    const data = response.data.data;
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

                    {/* === CLEANED UP NOTIFICATION COMPONENT === */}
                    <BellNotification api={adminApi} />

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