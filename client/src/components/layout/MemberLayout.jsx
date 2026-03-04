import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Menu, X, User, Home } from 'lucide-react';
import './MemberLayout.css';

const MemberLayout = ({ children }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="member-layout">
            {/* Header */}
            <header className="member-header">
                <div className="header-content">
                    <div className="header-left">
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <h1 className="app-title">Member Portal</h1>
                    </div>
                    <div className="user-info">
                        <span className="user-name">
                            <User size={16} />
                            {user?.name || 'Member'}
                        </span>
                        <button className="logout-btn" onClick={handleLogout}>
                            <LogOut size={16} />
                            <span className="logout-text">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Navigation (optional) */}
            {mobileMenuOpen && (
                <div className="mobile-nav">
                    <nav>
                        <ul>
                            <li>
                                <button onClick={() => { setMobileMenuOpen(false); navigate('/member/dashboard'); }}>
                                    <Home size={18} />
                                    Dashboard
                                </button>
                            </li>
                            {/* Add more member navigation items later */}
                        </ul>
                    </nav>
                </div>
            )}

            {/* Main Content */}
            <main className="member-main">
                <div className="member-content">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MemberLayout;