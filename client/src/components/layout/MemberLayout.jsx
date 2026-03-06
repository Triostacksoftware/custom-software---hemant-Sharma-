import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import './MemberLayout.css';

const UserLayout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const menuItems = [
        { path: '/user/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="user-layout">
            <aside className={`user-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2 className="sidebar-title">Member Portal</h2>
                    <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="user-info">
                    <div className="user-avatar">{user?.name?.charAt(0) || 'M'}</div>
                    <div className="user-details">
                        <h3 className="user-name">{user?.name || 'Member'}</h3>
                        <p className="user-role">Member</p>
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

            <main className="user-main">
                <header className="mobile-header">
                    <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
                        <Menu size={24} />
                    </button>
                    <h1 className="page-title">
                        {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                    </h1>
                </header>
                <div className="user-content">{children}</div>
            </main>
        </div>
    );
};

export default UserLayout;