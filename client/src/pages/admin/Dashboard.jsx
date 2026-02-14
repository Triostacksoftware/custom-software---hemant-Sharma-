import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import {
    User,
    Briefcase,
    Users,
    FolderOpen,
    ChevronRight,
    Activity,
    Users as MembersIcon, // alias for members icon
    CheckCircle
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState({
        groups: { total: 0, active: 0, draft: 0, completed: 0 },
        users: { total: 0, pending: 0, approved: 0, rejected: 0 },
        employees: { total: 0, pending: 0, approved: 0, rejected: 0 },
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await adminApi.dashboard.stats();
            setStats(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load dashboard statistics');
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        {
            title: 'Approve Users',
            description: 'Review and approve pending user registrations',
            icon: <User size={20} />,
            link: '/admin/approvals',
            count: stats.users.pending,
        },
        {
            title: 'Approve Employees',
            description: 'Review and approve pending employee registrations',
            icon: <Briefcase size={20} />,
            link: '/admin/approvals',
            count: stats.employees.pending,
        },
        {
            title: 'View Members',
            description: 'See all registered members and their status',
            icon: <MembersIcon size={20} />,
            link: '/admin/members',
            count: stats.users.total,
        },
        {
            title: 'Create Group',
            description: 'Start a new chit fund group',
            icon: <Users size={20} />,
            link: '/admin/create-group',
        },
        {
            title: 'View Groups',
            description: 'Manage all chit fund groups',
            icon: <FolderOpen size={20} />,
            link: '/admin/groups',
            count: stats.groups.total,
        },
    ];

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title">Admin Dashboard</h1>
                <p className="dashboard-subtitle">Overview and quick actions</p>
            </div>

            {error && (
                <div className="dashboard-error">
                    <strong>Error:</strong> {error}
                    <button onClick={fetchDashboardStats}>Retry</button>
                </div>
            )}

            {/* Metric Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon total-groups">
                        <FolderOpen size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 className="stat-value">{stats.groups.total}</h3>
                        <p className="stat-label">Total Groups</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon total-members">
                        <MembersIcon size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 className="stat-value">{stats.users.total}</h3>
                        <p className="stat-label">Total Members</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon active-groups">
                        <Activity size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 className="stat-value">{stats.groups.active}</h3>
                        <p className="stat-label">Active Groups</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon active-members">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 className="stat-value">{stats.users.approved}</h3>
                        <p className="stat-label">Active Members</p>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions-section">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions-grid">
                    {quickActions.map((action, index) => (
                        <Link to={action.link} key={index} className="quick-action-card">
                            <div className="action-icon">
                                {action.icon}
                            </div>
                            <div className="action-content">
                                <div className="action-header">
                                    <h3 className="action-title">{action.title}</h3>
                                    {action.count !== undefined && (
                                        <span className="action-count">{action.count}</span>
                                    )}
                                </div>
                                <p className="action-description">{action.description}</p>
                            </div>
                            <ChevronRight size={18} className="action-arrow" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;