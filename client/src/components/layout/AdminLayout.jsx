import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, CheckCircle, Users, PlusCircle, FolderOpen, LogOut, Briefcase } from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const menuItems = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/admin/approvals', label: 'Approvals', icon: <CheckCircle size={20} /> },
        { path: '/admin/members', label: 'Members', icon: <Users size={20} /> },
        { path: '/admin/employees', label: 'Employees', icon: <Briefcase size={20} /> },
        { path: '/admin/groups', label: 'Groups', icon: <FolderOpen size={20} /> },
        { path: '/admin/create-group', label: 'Create Group', icon: <PlusCircle size={20} /> },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2 className="sidebar-title">Kamauti Pro Admin</h2>
                    <button
                        className="mobile-close-btn"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        ✕
                    </button>
                </div>

                <div className="admin-info">
                    <div className="admin-avatar">{user?.name?.charAt(0) || 'A'}</div>
                    <div className="admin-details">
                        <h3 className="admin-name">{user?.name || 'Admin'}</h3>
                        <p className="admin-role">Administrator</p>
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
            <main className="admin-main">
                {/* Mobile Header */}
                <header className="mobile-header">
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        ☰
                    </button>
                    <h1 className="page-title">
                        {menuItems.find(item => item.path === location.pathname)?.label || 'Admin Dashboard'}
                    </h1>
                </header>

                {/* Content */}
                <div className="admin-content">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;