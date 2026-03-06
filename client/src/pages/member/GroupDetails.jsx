import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userApi } from '../../api/userApi';
import { io } from 'socket.io-client';
import {
    ArrowLeft, Users, Calendar, IndianRupee, Award, Clock,
    TrendingUp, ChevronDown, ChevronUp, Loader, AlertCircle,
    CheckCircle, X
} from 'lucide-react';
import './GroupDetails.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const GroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [biddingRound, setBiddingRound] = useState(null);
    const [bids, setBids] = useState([]);
    const [bidAmount, setBidAmount] = useState('');
    const [placingBid, setPlacingBid] = useState(false);
    const [bidError, setBidError] = useState('');
    const [bidSuccess, setBidSuccess] = useState('');
    const [showBidHistory, setShowBidHistory] = useState(false);
    const [socket, setSocket] = useState(null);

    const [confirming, setConfirming] = useState(false);
    const [confirmType, setConfirmType] = useState(null);
    const [confirmAmount, setConfirmAmount] = useState('');
    const [confirmError, setConfirmError] = useState('');
    const [confirmSuccess, setConfirmSuccess] = useState('');

    useEffect(() => {
        fetchGroupDetails();
        return () => {
            if (socket) socket.disconnect();
        };
    }, [groupId]);

    useEffect(() => {
        if (biddingRound && biddingRound.status === 'OPEN') {
            const newSocket = io(SOCKET_URL);
            setSocket(newSocket);

            newSocket.on('connect', () => {
                newSocket.emit('joinBiddingRoom', { biddingRoundId: biddingRound._id });
            });

            newSocket.on('newBidPlaced', (bid) => {
                setBids(prev => [...prev, bid]);
            });

            newSocket.on('biddingClosed', (data) => {
                setBiddingRound(prev => ({ ...prev, status: 'CLOSED' }));
                setBidSuccess(data.message || 'Bidding closed');
            });
        }
    }, [biddingRound]);

    const fetchGroupDetails = async () => {
        try {
            setLoading(true);
            const response = await userApi.getGroupDetails(groupId);
            const data = response.data.data;
            setGroupData(data);
            setBiddingRound(data.currentBiddingRound);
            setBids(data.bids || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load group details');
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceBid = async (e) => {
        e.preventDefault();
        if (!biddingRound || biddingRound.status !== 'OPEN') return;
        setPlacingBid(true);
        setBidError('');
        setBidSuccess('');
        try {
            await userApi.placeBid({ biddingRoundId: biddingRound._id, bidAmount: Number(bidAmount) });
            setBidSuccess('Bid placed successfully!');
            setBidAmount('');
        } catch (err) {
            setBidError(err.response?.data?.message || 'Failed to place bid');
        } finally {
            setPlacingBid(false);
        }
    };

    const handleConfirmTransaction = async (e) => {
        e.preventDefault();
        if (!confirmType || !confirmAmount) return;
        setConfirming(true);
        setConfirmError('');
        setConfirmSuccess('');
        try {
            await userApi.confirmTransaction({
                groupId,
                biddingRoundId: biddingRound?._id,
                monthNumber: groupData.group.currentMonth,
                amount: Number(confirmAmount),
                type: confirmType
            });
            setConfirmSuccess('Transaction confirmed successfully!');
            setConfirmAmount('');
            setConfirmType(null);
            fetchGroupDetails(); // refresh data
        } catch (err) {
            setConfirmError(err.response?.data?.message || 'Failed to confirm transaction');
        } finally {
            setConfirming(false);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
    const formatDate = (date) => new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (loading) return <div className="loading-container"><Loader size={40} className="spinner" /><p>Loading group details...</p></div>;
    if (error) return <div className="error-container"><AlertCircle size={40} /><p>{error}</p><button onClick={fetchGroupDetails}>Retry</button></div>;
    if (!groupData) return null;

    const { group, memberInfo, transactions, biddingHistory } = groupData;
    const isWinner = memberInfo?.hasWon;
    const pendingContribution = memberInfo?.pendingContribution || 0;
    const pendingPayout = memberInfo?.pendingPayout || 0;

    return (
        <div className="group-details-page">
            <button className="back-btn" onClick={() => navigate('/user/dashboard')}><ArrowLeft size={18} /> Back</button>
            <h1 className="page-title">{group.name}</h1>

            <div className="info-cards">
                <div className="info-card"><Users size={20} /><div><span className="info-label">Total Members</span><span className="info-value">{group.totalMembers}</span></div></div>
                <div className="info-card"><Calendar size={20} /><div><span className="info-label">Duration</span><span className="info-value">{group.totalMonths} months</span></div></div>
                <div className="info-card"><IndianRupee size={20} /><div><span className="info-label">Monthly Contribution</span><span className="info-value">{formatCurrency(group.monthlyContribution)}</span></div></div>
                <div className="info-card"><Clock size={20} /><div><span className="info-label">Current Month</span><span className="info-value">{group.currentMonth}/{group.totalMonths}</span></div></div>
                {isWinner && (
                    <div className="info-card winner">
                        <Award size={20} />
                        <div>
                            <span className="info-label">You Won!</span>
                            <span className="info-value">{formatCurrency(memberInfo.winningAmount)}</span>
                        </div>
                    </div>
                )}
            </div>

            {biddingRound && (
                <div className="bidding-section">
                    <h2 className="section-title">Bidding</h2>
                    <div className="bidding-status">
                        <span className={`status-badge ${biddingRound.status.toLowerCase()}`}>{biddingRound.status}</span>
                        {biddingRound.status === 'OPEN' && <span>Ends at {formatDate(biddingRound.endedAt)}</span>}
                    </div>
                    {biddingRound.status === 'OPEN' && !isWinner && (
                        <form onSubmit={handlePlaceBid} className="bid-form">
                            <div className="form-group">
                                <label>Your Bid (₹)</label>
                                <input
                                    type="number"
                                    value={bidAmount}
                                    onChange={(e) => setBidAmount(e.target.value)}
                                    placeholder={`Min ${formatCurrency(biddingRound.minBid)} - Max ${formatCurrency(biddingRound.maxBid)}`}
                                    min={biddingRound.minBid}
                                    max={biddingRound.maxBid}
                                    required
                                    disabled={placingBid}
                                />
                                <small>Bid must be between {formatCurrency(biddingRound.minBid)} and {formatCurrency(biddingRound.maxBid)}</small>
                            </div>
                            {bidError && <div className="error-message"><AlertCircle size={16} /> {bidError}</div>}
                            {bidSuccess && <div className="success-message"><CheckCircle size={16} /> {bidSuccess}</div>}
                            <button type="submit" className="submit-btn" disabled={placingBid}>
                                {placingBid ? <><Loader size={16} className="spinner" /> Placing...</> : 'Place Bid'}
                            </button>
                        </form>
                    )}
                    {biddingRound.status === 'OPEN' && isWinner && (
                        <p className="info-message">You have already won in this group and cannot bid again.</p>
                    )}
                    {bids.length > 0 && (
                        <div className="bid-history">
                            <button className="toggle-history" onClick={() => setShowBidHistory(!showBidHistory)}>
                                {showBidHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />} {showBidHistory ? 'Hide' : 'Show'} Bid History
                            </button>
                            {showBidHistory && (
                                <div className="bid-list">
                                    {bids.map((bid, idx) => (
                                        <div key={idx} className="bid-item">
                                            <span className="bidder">{bid.name}</span>
                                            <span className="bid-amount">{formatCurrency(bid.bidAmount)}</span>
                                            <span className="bid-time">{formatDate(bid.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {(pendingContribution > 0 || pendingPayout > 0) && (
                <div className="confirmation-section">
                    <h2 className="section-title">Pending Payments</h2>
                    {pendingContribution > 0 && (
                        <div className="pending-item">
                            <span>Contribution due: {formatCurrency(pendingContribution)}</span>
                            <button className="confirm-btn" onClick={() => setConfirmType('CONTRIBUTION')}>Confirm Payment</button>
                        </div>
                    )}
                    {pendingPayout > 0 && (
                        <div className="pending-item">
                            <span>Payout receivable: {formatCurrency(pendingPayout)}</span>
                            <button className="confirm-btn" onClick={() => setConfirmType('WINNER_PAYOUT')}>Confirm Receipt</button>
                        </div>
                    )}
                    {confirmType && (
                        <div className="confirm-modal">
                            <div className="modal-content">
                                <h3>Confirm {confirmType === 'CONTRIBUTION' ? 'Payment' : 'Receipt'}</h3>
                                <form onSubmit={handleConfirmTransaction}>
                                    <div className="form-group">
                                        <label>Amount (₹)</label>
                                        <input
                                            type="number"
                                            value={confirmAmount}
                                            onChange={(e) => setConfirmAmount(e.target.value)}
                                            placeholder="Enter amount"
                                            min="1"
                                            max={confirmType === 'CONTRIBUTION' ? pendingContribution : pendingPayout}
                                            required
                                            disabled={confirming}
                                        />
                                    </div>
                                    {confirmError && <div className="error-message"><AlertCircle size={16} /> {confirmError}</div>}
                                    {confirmSuccess && <div className="success-message"><CheckCircle size={16} /> {confirmSuccess}</div>}
                                    <div className="modal-actions">
                                        <button type="button" className="cancel-btn" onClick={() => setConfirmType(null)}>Cancel</button>
                                        <button type="submit" className="submit-btn" disabled={confirming}>
                                            {confirming ? <Loader size={16} className="spinner" /> : 'Confirm'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="history-section">
                <h2 className="section-title">Transaction History</h2>
                {transactions.length === 0 ? (
                    <p className="no-data">No transactions yet.</p>
                ) : (
                    <table className="transactions-table">
                        <thead>
                            <tr><th>Date</th><th>Type</th><th>Month</th><th>Amount</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => (
                                <tr key={tx._id}>
                                    <td>{formatDate(tx.createdAt)}</td>
                                    <td>{tx.type === 'CONTRIBUTION' ? 'Contribution' : 'Payout'}</td>
                                    <td>{tx.monthNumber}</td>
                                    <td>{formatCurrency(tx.amount)}</td>
                                    <td><span className={`status-badge ${tx.status.toLowerCase()}`}>{tx.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="history-section">
                <h2 className="section-title">Bidding History</h2>
                {biddingHistory.length === 0 ? (
                    <p className="no-data">No bidding history.</p>
                ) : (
                    <table className="bidding-table">
                        <thead>
                            <tr><th>Month</th><th>Your Bid</th><th>Winning Bid</th><th>Result</th></tr>
                        </thead>
                        <tbody>
                            {biddingHistory.map((round, idx) => (
                                <tr key={idx}>
                                    <td>Month {round.monthNumber}</td>
                                    <td>{round.userBid ? formatCurrency(round.userBid) : '—'}</td>
                                    <td>{round.winningBid ? formatCurrency(round.winningBid) : '—'}</td>
                                    <td>
                                        {round.winnerUserId === groupData.userId ? (
                                            <span className="win-badge">Won</span>
                                        ) : round.winnerUserId ? (
                                            <span className="lost-badge">Lost</span>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default GroupDetails;