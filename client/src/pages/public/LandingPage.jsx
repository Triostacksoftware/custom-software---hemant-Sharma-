import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, Shield, CheckCircle } from 'lucide-react';
import RoleCard from '../../components/auth/RoleCard';
import AuthModal from '../../components/auth/AuthModal';
import './LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const [activeModal, setActiveModal] = useState(null);
    const [authMode, setAuthMode] = useState('login');

    // New State for the custom success popup
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);

    const handleRoleAction = (role, action) => {
        setAuthMode(action);
        setActiveModal(role);
    };

    const handleCloseModal = () => {
        setActiveModal(null);
    };

    // Function to switch between login and signup for same role
    const switchAuthMode = (role, newMode) => {
        setAuthMode(newMode);
        setActiveModal(role);
    };

    const handleAuthSuccess = (role, token) => {
        setActiveModal(null);
        localStorage.setItem('token', token);

        switch (role) {
            case 'admin':
                navigate('/admin/dashboard');
                break;
            case 'employee':
                navigate('/employee/dashboard');
                break;
            case 'user':
                navigate('/user/dashboard');
                break;
            default:
                navigate('/');
        }
    };

    // New Function to handle Registration Success
    const handleRegistrationSuccess = () => {
        setActiveModal(null); // Closes the AuthModal automatically
        setShowSuccessPopup(true); // Shows the beautiful custom popup

        // Auto close after 6 seconds
        setTimeout(() => {
            setShowSuccessPopup(false);
        }, 6000);
    };

    return (
        <div className="landing-page">
            {/* Header */}
            <header className="landing-header">
                <div className="container">
                    <div className="header-content">
                        <div className="logo">
                            <div className="logo-icon">
                                <Shield size={24} />
                            </div>
                            <span className="logo-text">Kamauti<span className="logo-text-accent">Pro</span></span>
                        </div>
                        <button
                            className="admin-login-btn"
                            onClick={() => handleRoleAction('admin', 'login')}
                        >
                            Admin Login
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                <div className="container">
                    <div className="content-wrapper">
                        <div className="role-section">
                            <div className="section-header">
                                <h2 className="section-title">Select Your Role</h2>
                                <p className="section-subtitle">Choose how you want to access the platform</p>
                            </div>

                            <div className="role-grid">
                                <RoleCard
                                    title="Member"
                                    description="Join groups, manage contributions and payments, participate in bidding"
                                    icon={<User size={32} />}
                                    primaryColor="#2563eb"
                                    onLogin={() => handleRoleAction('user', 'login')}
                                    onSignup={() => handleRoleAction('user', 'signup')}
                                    isPrimary={true}
                                />

                                <RoleCard
                                    title="Employee"
                                    description="Collect contributions, manage member records, and process transactions"
                                    icon={<Briefcase size={32} />}
                                    primaryColor="#10b981"
                                    onLogin={() => handleRoleAction('employee', 'login')}
                                    onSignup={() => handleRoleAction('employee', 'signup')}
                                    isPrimary={false}
                                />

                                <RoleCard
                                    title="Administrator"
                                    description="Oversee operations, approve members, and manage group lifecycle"
                                    icon={<Shield size={32} />}
                                    primaryColor="#8b5cf6"
                                    onLogin={() => handleRoleAction('admin', 'login')}
                                    isPrimary={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Auth Modals */}
            {activeModal && (
                <AuthModal
                    role={activeModal}
                    mode={authMode}
                    onClose={handleCloseModal}
                    onSuccess={handleAuthSuccess}
                    onSwitchMode={switchAuthMode}
                    onRegistrationSuccess={handleRegistrationSuccess} // Passed down to AuthModal
                />
            )}

            {/* Custom Registration Success Popup */}
            {showSuccessPopup && (
                <div className="success-popup-overlay">
                    <div className="success-popup-card">
                        <div className="success-popup-icon">
                            <CheckCircle size={44} />
                        </div>
                        <h3>Registration Successful!</h3>
                        <p>Your account has been created successfully.</p>
                        <div className="approval-text-box">
                            <p>You can login after the admin approves your account.</p>
                            <p className="contact-admin-text"><strong>Please contact your admin to expedite the process.</strong></p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;