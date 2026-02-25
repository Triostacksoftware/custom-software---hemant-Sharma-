import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    LayoutDashboard,
    FileText,
    History,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import './EmployeeLayout.css';

const EmployeeLayout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const menuItems = [
        { path: '/employee/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/employee/log-contribution', label: 'Log Contribution', icon: <FileText size={20} /> },
        { path: '/employee/history', label: 'Contribution History', icon: <History size={20} /> },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="employee-layout">
            {/* Sidebar */}
            <aside className={`employee-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2 className="sidebar-title">Employee Portal</h2>
                    <button
                        className="mobile-close-btn"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="employee-info">
                    <div className="employee-avatar">{user?.name?.charAt(0) || 'E'}</div>
                    <div className="employee-details">
                        <h3 className="employee-name">{user?.name || 'Employee'}</h3>
                        <p className="employee-role">Field Collector</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <ul className="nav-list">
                        {menuItems.map((item) => (
                            <li key={item.path} className="nav-item">
                                <Link
                                    to={item.path}
                                    className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    <span className="nav-label">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="employee-main">
                {/* Mobile Header */}
                <header className="mobile-header">
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="page-title">
                        {menuItems.find(item => item.path === location.pathname)?.label || 'Employee Dashboard'}
                    </h1>
                </header>

                {/* Content */}
                <div className="employee-content">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default EmployeeLayout;