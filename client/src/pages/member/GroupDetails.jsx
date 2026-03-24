import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, IndianRupee, Users, Calendar, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { userApi } from '../../api/userApi';
import './GroupDetails.css';

const MemberGroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [details, setDetails] = useState(null);

    useEffect(() => {
        fetchDetails();
    }, [groupId]);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const response = await userApi.getGroupDetails(groupId);
            if (response.data.success) {
                setDetails(response.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load group details');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return '-';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    };

    const getTransactionLabel = (type) => {
        if (type === 'CONTRIBUTION') return 'Monthly Contribution';
        if (type === 'WINNER_PAYOUT') return 'Winner Payout';
        return type;
    };

    if (loading) {
        return (
            <div className="elder-group-details-container center-content">
                <div className="spinner"></div>
                <p className="loading-text">Loading details...</p>
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="elder-group-details-container center-content">
                <p className="error-text">{error || 'Could not find details.'}</p>
                <button className="elder-btn-primary" onClick={() => navigate('/user/groups')}>Go Back</button>
            </div>
        );
    }

    const { group, memberInfo, transactions, biddingHistory } = details;

    return (
        <div className="elder-group-details-container">
            {/* Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/user/groups')}>
                        <ArrowLeft size={24} />
                        <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">{group.name}</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="details-main-content">

                {/* Top Summary Cards Layer */}
                <div className="summary-cards-grid">

                    {/* Group Overview Card */}
                    <div className="elder-summary-card">
                        <h2 className="summary-title">Group Information</h2>
                        <div className="summary-list">
                            <div className="summary-item">
                                <span className="item-label"><IndianRupee size={18} /> Monthly Amount</span>
                                <span className="item-value">{formatCurrency(group.monthlyContribution)}</span>
                            </div>
                            <div className="summary-item">
                                <span className="item-label"><Calendar size={18} /> Current Month</span>
                                <span className="item-value">Month {group.currentMonth} of {group.totalMonths}</span>
                            </div>
                            <div className="summary-item">
                                <span className="item-label"><Users size={18} /> Total Members</span>
                                <span className="item-value">{group.totalMembers} People</span>
                            </div>
                            <div className="summary-item">
                                <span className="item-label"><Clock size={18} /> Started On</span>
                                <span className="item-value">{formatDate(group.startDate)}</span>
                            </div>
                        </div>
                    </div>

                    {/* My Financial Status Card */}
                    <div className="elder-summary-card status-card">
                        <h2 className="summary-title">My Status</h2>
                        <div className="summary-list">
                            <div className="summary-item">
                                <span className="item-label">Winning Status</span>
                                <span className={`item-value ${memberInfo.hasWon ? 'text-green' : 'text-gray'}`}>
                                    {memberInfo.hasWon ? `Won in Month ${memberInfo.winningMonth}` : 'Not yet won'}
                                </span>
                            </div>

                            {/* Pending Owed Amount */}
                            <div className="summary-item alert-box">
                                <span className="item-label"><AlertCircle size={18} /> Pending to Pay</span>
                                <span className={`item-value ${memberInfo.pendingContribution > 0 ? 'text-red font-bold' : 'text-green'}`}>
                                    {memberInfo.pendingContribution > 0 ? formatCurrency(memberInfo.pendingContribution) : 'All Clear'}
                                </span>
                            </div>

                            {/* Pending Receivable Amount */}
                            <div className="summary-item success-box">
                                <span className="item-label"><CheckCircle size={18} /> Amount to Receive</span>
                                <span className={`item-value ${memberInfo.pendingPayout > 0 ? 'text-green font-bold' : 'text-gray'}`}>
                                    {memberInfo.pendingPayout > 0 ? formatCurrency(memberInfo.pendingPayout) : 'None'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="elder-divider"></div>

                {/* Transactions Section */}
                <section className="elder-section">
                    <h2 className="elder-section-title">My Transactions</h2>
                    {transactions && transactions.length > 0 ? (
                        <div className="elder-list-container">
                            {transactions.map((tx) => (
                                <div key={tx._id} className="elder-strip-card">
                                    <div className="strip-left">
                                        <div className={`icon-circle ${tx.type === 'WINNER_PAYOUT' ? 'bg-green' : 'bg-blue'}`}>
                                            <IndianRupee size={20} />
                                        </div>
                                        <div className="strip-info">
                                            <h4 className="strip-title">{getTransactionLabel(tx.type)}</h4>
                                            <span className="strip-subtitle">{formatDate(tx.createdAt)} • Month {tx.monthNumber}</span>
                                        </div>
                                    </div>
                                    <div className="strip-right text-right">
                                        <span className={`strip-amount ${tx.type === 'WINNER_PAYOUT' ? 'text-green' : 'text-blue'}`}>
                                            {tx.type === 'WINNER_PAYOUT' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </span>
                                        <span className={`status-badge ${tx.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                                            {tx.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="elder-empty-box">No transactions recorded yet.</div>
                    )}
                </section>

                <div className="elder-divider"></div>

                {/* Bidding History Section */}
                <section className="elder-section">
                    <h2 className="elder-section-title">Past Bidding Results</h2>
                    {biddingHistory && biddingHistory.length > 0 ? (
                        <div className="elder-list-container">
                            {biddingHistory.map((history, index) => (
                                <div key={index} className="elder-strip-card">
                                    <div className="strip-left">
                                        <div className="icon-circle bg-gray">
                                            <TrendingUp size={20} />
                                        </div>
                                        <div className="strip-info">
                                            <h4 className="strip-title">Month {history.monthNumber}</h4>
                                            {history.userBid ? (
                                                <span className="strip-subtitle text-blue">My Bid: {formatCurrency(history.userBid)}</span>
                                            ) : (
                                                <span className="strip-subtitle">Did not bid</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="strip-right text-right">
                                        <span className="strip-amount text-dark">
                                            Winning Bid: {formatCurrency(history.winningBid)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="elder-empty-box">No past bidding history available.</div>
                    )}
                </section>

            </main>
        </div>
    );
};

export default MemberGroupDetails;