import React, { useState, useEffect } from 'react';
import { employeeApi } from '../../api/employeeApi';
import {
    Users,
    FolderOpen,
    IndianRupee,
    Clock,
    TrendingUp,
    Award,
    UserCheck,
    ChevronRight,
    Loader
} from 'lucide-react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';

const EmployeeDashboard = () => {
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
            setError('');
            const response = await employeeApi.getDashboard();
            setDashboardData(response.data.dashboard);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load dashboard');
            console.error('Dashboard error:', err);
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

    const getBiddingStatusBadge = (status) => {
        switch (status) {
            case 'COMPLETED':
                return <span className="badge completed">Completed</span>;
            case 'PENDING':
                return <span className="badge pending">Pending</span>;
            case 'NOT_CREATED':
                return <span className="badge not-created">Not Created</span>;
            default:
                return <span className="badge">{status}</span>;
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

    const {
        totalActiveGroups,
        totalMembers,
        totalCollectionCurrentMonth,
        pendingContributionCount,
        groups
    } = dashboardData;

    return (
        <div className="employee-dashboard">
            <h1 className="page-title">Welcome, Employee</h1>
            <p className="page-subtitle">Manage monthly contributions and track group progress</p>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon groups">
                        <FolderOpen size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Active Groups</span>
                        <span className="stat-value">{totalActiveGroups}</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon members">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Total Members</span>
                        <span className="stat-value">{totalMembers}</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon collection">
                        <IndianRupee size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Collected This Month</span>
                        <span className="stat-value">{formatCurrency(totalCollectionCurrentMonth)}</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon pending">
                        <Clock size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Pending Contributions</span>
                        <span className="stat-value">{pendingContributionCount}</span>
                    </div>
                </div>
            </div>

            {/* Groups Table */}
            <div className="groups-section">
                <h2 className="section-title">Active Groups</h2>
                {groups.length === 0 ? (
                    <p className="no-data">No active groups found.</p>
                ) : (
                    <div className="groups-table-container">
                        <table className="groups-table">
                            <thead>
                                <tr>
                                    <th>Group Name</th>
                                    <th>Current Month</th>
                                    <th>Total Members</th>
                                    <th>Collected</th>
                                    <th>Pending</th>
                                    <th>Progress</th>
                                    <th>Bidding Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((group) => (
                                    <tr key={group.groupId}>
                                        <td className="group-name">{group.name}</td>
                                        <td>Month {group.currentMonth}</td>
                                        <td>{group.totalMembers}</td>
                                        <td>{formatCurrency(group.totalCollected)}</td>
                                        <td className={group.pendingMembersCount > 0 ? 'pending' : 'paid'}>
                                            {group.pendingMembersCount}
                                        </td>
                                        <td>
                                            <div className="progress-container">
                                                <div
                                                    className="progress-bar"
                                                    style={{ width: `${group.collectionProgressPercentage}%` }}
                                                />
                                                <span className="progress-text">
                                                    {group.collectionProgressPercentage}%
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {getBiddingStatusBadge(group.bidding.status)}
                                            {group.bidding.status === 'COMPLETED' && (
                                                <div className="bidding-info">
                                                    <small>Winner: {group.bidding.winnerUserId || 'N/A'}</small>
                                                    <small>Bid: {formatCurrency(group.bidding.winningBidAmount)}</small>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="action-btn"
                                                onClick={() => navigate('/employee/log-contribution', { state: { groupId: group.groupId } })}
                                            >
                                                Log Contribution
                                                <ChevronRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeDashboard;