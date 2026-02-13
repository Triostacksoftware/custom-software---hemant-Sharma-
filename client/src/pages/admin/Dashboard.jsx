import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    User,
    Briefcase,
    Users,
    FolderOpen,
    ChevronRight
} from 'lucide-react';
import adminApi from '../../api/adminApi';
import './Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalGroups: 0,
        activeGroups: 0,
        pendingUsers: 0,
        pendingEmployees: 0,
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
            // Mock data – replace with real API call
            const mockStats = {
                totalGroups: 12,
                activeGroups: 8,
                pendingUsers: 5,
                pendingEmployees: 3,
            };
            setStats(mockStats);
        } catch (err) {
            setError('Failed to load dashboard statistics');
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        {
            title: 'View Members',
            description: 'See all registered members and their status',
            icon: <Users size={20} />,
            link: '/admin/members',
            count: stats.totalUsers, // you'd need to fetch total users count
        },
        {
            title: 'Approve Users',
            description: 'Review and approve pending user registrations',
            icon: <User size={20} />,
            link: '/admin/approvals',
            count: stats.pendingUsers,
        },
        {
            title: 'Approve Employees',
            description: 'Review and approve pending employee registrations',
            icon: <Briefcase size={20} />,
            link: '/admin/approvals',
            count: stats.pendingEmployees,
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
            count: stats.totalGroups,
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

            {/* Metric Cards – no icons, just numbers and labels */}
            <div className="stats-grid">
                <div className="stat-card">
                    <h3 className="stat-value">{stats.totalGroups}</h3>
                    <p className="stat-label">Total Groups</p>
                </div>
                <div className="stat-card">
                    <h3 className="stat-value">{stats.activeGroups}</h3>
                    <p className="stat-label">Active Groups</p>
                </div>
                <div className="stat-card">
                    <h3 className="stat-value">{stats.pendingUsers}</h3>
                    <p className="stat-label">Pending Users</p>
                </div>
                <div className="stat-card">
                    <h3 className="stat-value">{stats.pendingEmployees}</h3>
                    <p className="stat-label">Pending Employees</p>
                </div>
            </div>

            {/* Quick Actions – left‑aligned, muted accents, thin icons */}
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