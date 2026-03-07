import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../api/userApi';
import { Users, IndianRupee, Award, Clock, ChevronRight, Loader } from 'lucide-react';
import './Dashboard.css';

const MemberDashboard = () => {
    const navigate = useNavigate();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const response = await userApi.getDashboard();
            setDashboardData(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Group status badge class
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'ACTIVE': return 'badge active';
            case 'DRAFT': return 'badge draft';
            case 'COMPLETED': return 'badge completed';
            default: return 'badge';
        }
    };

    // Human-readable group status
    const getGroupStatusText = (status) => {
        switch (status) {
            case 'ACTIVE': return 'Active';
            case 'DRAFT': return 'Draft';
            case 'COMPLETED': return 'Completed';
            default: return status;
        }
    };

    // Bidding status badge class
    const getBiddingBadgeClass = (status) => {
        switch (status) {
            case 'OPEN': return 'badge bidding-open';
            case 'PAYMENT_OPEN': return 'badge bidding-payment';
            case 'CLOSED': return 'badge bidding-closed';
            case 'PENDING': return 'badge bidding-pending';
            case 'COLLECTION_DONE': return 'badge bidding-collection';
            case 'FINALIZED': return 'badge bidding-finalized';
            default: return 'badge bidding-not-created';
        }
    };

    // Human-readable bidding status (without prefix)
    const getBiddingStatusText = (status) => {
        switch (status) {
            case 'OPEN': return 'Open';
            case 'PAYMENT_OPEN': return 'Payment Open';
            case 'CLOSED': return 'Closed';
            case 'PENDING': return 'Pending';
            case 'COLLECTION_DONE': return 'Collection Done';
            case 'FINALIZED': return 'Finalized';
            case 'NOT_CREATED': return 'Not Created';
            default: return status;
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <Loader size={40} className="spinner" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <p>Error: {error}</p>
                <button onClick={fetchDashboard}>Retry</button>
            </div>
        );
    }

    if (!dashboardData) return null;

    const { user, stats, groups } = dashboardData;

    return (
        <div className="member-dashboard">
            <h1 className="page-title">Welcome, {user?.name}</h1>
            <p className="page-subtitle">Your chit fund overview</p>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon groups"><Users size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Groups Joined</span>
                        <span className="stat-value">{stats.totalGroups}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon contribution"><IndianRupee size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Total Contribution</span>
                        <span className="stat-value">{formatCurrency(stats.totalContribution)}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon winnings"><Award size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Total Winnings</span>
                        <span className="stat-value">{formatCurrency(stats.totalWinnings)}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon pending"><Clock size={24} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Pending Payment</span>
                        <span className="stat-value">{formatCurrency(stats.pendingPayment)}</span>
                    </div>
                </div>
            </div>

            {/* Groups Section */}
            <div className="groups-section">
                <h2 className="section-title">Your Groups</h2>
                {groups.length === 0 ? (
                    <p className="no-data">You are not part of any group yet.</p>
                ) : (
                    <div className="groups-list">
                        {groups.map(group => (
                            <div
                                key={group.groupId}
                                className="group-card"
                                onClick={() => navigate(`/user/group/${group.groupId}`)}
                            >
                                <div className="group-header">
                                    <h3 className="group-name">{group.name}</h3>
                                    <div className="badge-container">
                                        {/* Bidding status badge with prefix */}
                                        <span className={getBiddingBadgeClass(group.biddingStatus)}>
                                            Bidding: {getBiddingStatusText(group.biddingStatus)}
                                        </span>
                                        {/* Group status badge with prefix */}
                                        <span className={getStatusBadgeClass(group.status)}>
                                            Group: {getGroupStatusText(group.status)}
                                        </span>
                                    </div>
                                </div>
                                <div className="group-details">
                                    <div className="detail-item">
                                        <span className="detail-label">Members</span>
                                        <span className="detail-value">{group.memberCount}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Monthly Contribution</span>
                                        <span className="detail-value">{formatCurrency(group.monthlyContribution)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Current Month</span>
                                        <span className="detail-value">{group.currentMonth}/{group.totalMonths}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Your Status</span>
                                        <span className="detail-value">{group.hasWon ? 'Winner' : 'Active'}</span>
                                    </div>
                                </div>
                                <div className="group-footer">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MemberDashboard;