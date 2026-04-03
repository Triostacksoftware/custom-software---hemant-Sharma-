import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, CalendarClock, PlayCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/userApi';
import './Bidding.css';

const BiddingDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [rounds, setRounds] = useState([]);

    useEffect(() => {
        fetchBiddingDashboard();
    }, []);

    const fetchBiddingDashboard = async () => {
        try {
            setLoading(true);
            const response = await userApi.getBiddingDashboard();
            if (response.data.success) {
                setRounds(response.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load bidding details');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Date not scheduled yet';
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="elder-bidding-container center-content">
                <div className="spinner"></div>
                <p className="loading-text">Loading bidding rounds...</p>
            </div>
        );
    }

    return (
        <div className="elder-bidding-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/user/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Bidding Rooms</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="bidding-main-content">
                <section className="elder-section">
                    <h2 className="elder-section-title">My Groups Bidding Status</h2>

                    {error && <p className="error-text">{error}</p>}

                    {rounds.length === 0 ? (
                        <div className="elder-empty-card">
                            <p>No active groups found for bidding.</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {rounds.map((round) => (
                                <div key={round.groupId} className="elder-list-card bidding-strip-card">
                                    <div className="list-card-left">
                                        <div className={`icon-wrapper ${round.status === 'OPEN' ? 'green-icon' : 'blue-icon'}`}>
                                            <Gavel size={28} />
                                        </div>
                                        <div className="list-card-info" style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                <h3 className="elder-card-title">{round.groupName}</h3>
                                                <span className="month-badge">Month {round.monthNumber}</span>
                                            </div>

                                            {round.status === 'OPEN' ? (
                                                <div className="status-indicator text-green">
                                                    <span className="live-dot"></span> Bidding is LIVE right now!
                                                </div>
                                            ) : round.status === 'PAYMENT_OPEN' || round.status === 'CLOSED' ? (
                                                <div className="results-summary-mini">
                                                    <div className="results-summary-header">
                                                        <CheckCircle size={16} /> Bidding Concluded
                                                    </div>
                                                    {round.winnerUserId ? (
                                                        <div className="results-summary-text">
                                                            {String(round.winnerUserId) === String(user?._id)
                                                                ? "🎉 You won! Wait for agent to process payout."
                                                                : `You owe: ₹${round.payablePerMember} (Dividend: ₹${round.dividendPerMember})`}
                                                        </div>
                                                    ) : (
                                                        <div className="results-summary-awaiting">
                                                            Awaiting Tie Resolution...
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="status-indicator text-gray">
                                                    <CalendarClock size={18} />
                                                    Scheduled: {formatDate(round.scheduledBiddingDate)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="list-card-right">
                                        {(round.status === 'OPEN' || round.status === 'CLOSED' || round.status === 'PAYMENT_OPEN') ? (
                                            <button
                                                className="elder-btn-primary enter-room-btn"
                                                onClick={() => navigate(`/user/bidding/room/${round.biddingRoundId}`)}
                                            >
                                                <PlayCircle size={20} /> {round.status === 'OPEN' ? 'Enter Room' : 'View Results'}
                                            </button>
                                        ) : (
                                            <button className="elder-btn-secondary" disabled>
                                                Waiting...
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default BiddingDashboard;