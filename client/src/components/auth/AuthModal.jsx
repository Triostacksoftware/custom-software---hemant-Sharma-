import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './AuthModal.css';

const AuthModal = ({ role, mode, onClose, onSuccess, onSwitchMode }) => {
    const { login, signup } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        phoneNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [apiResponse, setApiResponse] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
        setApiResponse(null);
    };

    const validateForm = () => {
        if (mode === 'signup' && formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }

        if (formData.phoneNumber.length !== 10) {
            setError('Please enter a valid 10-digit phone number');
            return false;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setApiResponse(null);

        try {
            const credentials = {
                phoneNumber: formData.phoneNumber,
                password: formData.password
            };

            let result;

            if (mode === 'login') {
                result = await login(role, credentials);
            } else {
                const userData = {
                    name: formData.name,
                    phoneNumber: formData.phoneNumber,
                    password: formData.password
                };
                result = await signup(role, userData);
            }

            if (result.success) {
                // FIX 2: Don't show raw response for login, redirect immediately
                if (mode === 'login' && result.data?.token) {
                    localStorage.setItem('token', result.data.token);
                    onSuccess(role, result.data.token); // Redirect immediately
                } else {
                    // For signup, show success message
                    setApiResponse({
                        type: 'success',
                        message: 'Registration successful!',
                        data: result.data
                    });
                    setLoading(false);
                }
            } else {
                setError(result.error);
                setLoading(false);
            }
        } catch (error) {
            setError(error.message || 'An error occurred. Please try again.');
            setLoading(false);
        }
    };

    const getRoleTitle = () => {
        const roleTitles = {
            user: 'Member',
            employee: 'Employee',
            admin: 'Administrator'
        };
        return roleTitles[role];
    };

    // Function to handle switching from login to signup
    const handleSwitchToSignup = () => {
        onClose(); // Close current modal
        // Use setTimeout to ensure modal closes before opening new one
        setTimeout(() => {
            onSwitchMode(role, 'signup');
        }, 100);
    };

    return (
        <div className="modal-overlay" data-testid="auth-modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{mode === 'login' ? 'Login' : 'Register'} as {getRoleTitle()}</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <form onSubmit={handleSubmit} noValidate>
                        {mode === 'signup' && role !== 'admin' && (
                            <div className="form-group">
                                <label htmlFor="name">Full Name *</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Enter your full name"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="phoneNumber">Phone Number *</label>
                            <input
                                type="tel"
                                id="phoneNumber"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleInputChange}
                                placeholder="Enter 10-digit phone number"
                                required
                                disabled={loading}
                                pattern="[0-9]{10}"
                                maxLength="10"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password *</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="Enter your password"
                                required
                                disabled={loading}
                                minLength="6"
                            />
                        </div>

                        {mode === 'signup' && (
                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm Password *</label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    placeholder="Confirm your password"
                                    required
                                    disabled={loading}
                                    minLength="6"
                                />
                            </div>
                        )}

                        {error && (
                            <div className="error-message" role="alert">
                                <strong>Error:</strong> {error}
                            </div>
                        )}

                        {/* FIX 2: Only show API response for signup, not for login */}
                        {apiResponse && mode === 'signup' && (
                            <div className={`api-response ${apiResponse.type}`}>
                                <div className="response-header">
                                    <strong>{apiResponse.type === 'success' ? '✓ Success!' : '✗ Error'}</strong>
                                </div>
                                <div className="response-message">{apiResponse.message}</div>
                                {role !== 'admin' && (
                                    <div className="response-note">
                                        Note: Your account requires admin approval before you can login.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-footer">
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        {mode === 'login' ? 'Logging in...' : 'Registering...'}
                                    </>
                                ) : (
                                    mode === 'login' ? 'Login' : 'Register'
                                )}
                            </button>

                            <p className="info-text">
                                {mode === 'login' ? (
                                    role === 'admin' ? (
                                        "Admin credentials are set by system administrator"
                                    ) : (
                                        <>
                                            Don't have an account?{' '}
                                            <button
                                                type="button"
                                                className="text-link"
                                                onClick={handleSwitchToSignup}
                                            >
                                                Register here
                                            </button>
                                        </>
                                    )
                                ) : (
                                    "After registering, you'll need admin approval before logging in"
                                )}
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;