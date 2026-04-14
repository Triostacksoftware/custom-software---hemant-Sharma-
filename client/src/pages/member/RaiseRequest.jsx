import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, IndianRupee, ArrowUpRight, ArrowDownLeft, CheckCircle, BellRing } from 'lucide-react';
import { userApi } from '../../api/userApi';
import './RaiseRequest.css';

const RaiseRequest = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [duesData, setDuesData] = useState([]);

    // Tracks which specific button is currently loading or has succeeded
    // Format: { 'grp_001_pay': 'loading', 'grp_002_receive': 'success' }
    const [requestStatuses, setRequestStatuses] = useState({});

    useEffect(() => {
        fetchPendingDues();
    }, []);

    const fetchPendingDues = async () => {
        try {
            setLoading(true);
            const response = await userApi.getPendingDues();
            if (response.data.success) {
                setDuesData(response.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load pending dues');
        } finally {
            setLoading(false);
        }
    };

    const handleRaiseRequest = async (groupId, type, amount) => {
        const statusKey = `${groupId}_${type}`;

        try {
            // Set this specific button to loading
            setRequestStatuses(prev => ({ ...prev, [statusKey]: 'loading' }));

            // Map the frontend 'pay'/'receive' to backend enums
            const backendType = type === 'pay' ? 'CONTRIBUTION' : 'WINNER_PAYOUT';

            // Call the live API
            const response = await userApi.raisePaymentRequest({
                groupId,
                type: backendType
            });

            if (response.data.success) {
                // Set to success to disable the button and show the CheckCircle
                setRequestStatuses(prev => ({ ...prev, [statusKey]: 'success' }));
            }

        } catch (err) {
            alert(err.response?.data?.message || "Failed to send request. Please try again.");
            setRequestStatuses(prev => ({ ...prev, [statusKey]: null }));
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="elder-request-container center-content">
                <div className="spinner"></div>
                <p className="loading-text">Loading your details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="elder-request-container center-content">
                <p className="error-text">{error}</p>
                <button className="elder-btn-primary" onClick={fetchPendingDues}>Try Again</button>
            </div>
        );
    }

    // Split data into two clear categories
    const toPayList = duesData.filter(item => item.pendingContribution > 0);
    const toReceiveList = duesData.filter(item => item.pendingPayout > 0);

    return (
        <div className="elder-request-container">
            {/* Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/user/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Raise Request</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="request-main-content">
                <p className="page-description">
                    Call an agent to your location to collect your payments or deliver your winnings.
                </p>

                {/* Section 1: Money to Receive (Highlighting the good news first) */}
                <section className="elder-section">
                    <h2 className="elder-section-title text-green">Money I Will Receive</h2>

                    {toReceiveList.length === 0 ? (
                        <div className="elder-empty-card">
                            <p>You have no pending winnings to receive right now.</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {toReceiveList.map((item) => {
                                const statusKey = `${item.groupId}_receive`;
                                const btnStatus = requestStatuses[statusKey];

                                return (
                                    <div key={statusKey} className="elder-list-card">
                                        <div className="list-card-left">
                                            <div className="icon-wrapper green-icon"><ArrowDownLeft size={28} /></div>
                                            <div className="list-card-info">
                                                <h3 className="elder-card-title">{item.groupName}</h3>
                                                <span className="amount-text text-green font-bold">
                                                    {formatCurrency(item.pendingPayout)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="list-card-right">
                                            {btnStatus === 'success' ? (
                                                <button className="elder-btn-success" disabled>
                                                    <CheckCircle size={20} /> Request Sent
                                                </button>
                                            ) : (
                                                <button
                                                    className="elder-btn-primary bg-green-btn"
                                                    onClick={() => handleRaiseRequest(item.groupId, 'receive', item.pendingPayout)}
                                                    disabled={btnStatus === 'loading'}
                                                >
                                                    {btnStatus === 'loading' ? 'Sending...' : <><BellRing size={18} /> Request Payout</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div className="elder-divider"></div>

                {/* Section 2: Money to Pay */}
                <section className="elder-section">
                    <h2 className="elder-section-title text-blue">Money I Need to Pay</h2>

                    {toPayList.length === 0 ? (
                        <div className="elder-empty-card">
                            <p>You have no pending contributions to pay right now. Great job!</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {toPayList.map((item) => {
                                const statusKey = `${item.groupId}_pay`;
                                const btnStatus = requestStatuses[statusKey];

                                return (
                                    <div key={statusKey} className="elder-list-card">
                                        <div className="list-card-left">
                                            <div className="icon-wrapper blue-icon"><ArrowUpRight size={28} /></div>
                                            <div className="list-card-info">
                                                <h3 className="elder-card-title">{item.groupName}</h3>
                                                <span className="amount-text text-blue font-bold">
                                                    {formatCurrency(item.pendingContribution)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="list-card-right">
                                            {btnStatus === 'success' ? (
                                                <button className="elder-btn-success" disabled>
                                                    <CheckCircle size={20} /> Request Sent
                                                </button>
                                            ) : (
                                                <button
                                                    className="elder-btn-primary"
                                                    onClick={() => handleRaiseRequest(item.groupId, 'pay', item.pendingContribution)}
                                                    disabled={btnStatus === 'loading'}
                                                >
                                                    {btnStatus === 'loading' ? 'Sending...' : <><BellRing size={18} /> Request Collection</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

            </main>
        </div>
    );
};

export default RaiseRequest;