import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, IndianRupee, Clock, Trophy, CheckCircle, Calendar } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/userApi';
import './Bidding.css';

const BiddingRoom = () => {
    const { roundId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);

    const [loading, setLoading] = useState(true);
    const [roundDetails, setRoundDetails] = useState(null);
    const [bids, setBids] = useState([]);

    const [bidAmount, setBidAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Room Flow States
    const [roomClosed, setRoomClosed] = useState(false);
    const [winnerData, setWinnerData] = useState(null);
    const [isFinalized, setIsFinalized] = useState(false);

    // Anonymization Map
    const [maskMap, setMaskMap] = useState({});
    const bidsEndRef = useRef(null);

    // Helper to safely extract ID whether it's a string or a populated Mongoose object
    const extractId = (idField) => {
        if (!idField) return null;
        if (typeof idField === 'object') return idField._id ? String(idField._id) : String(idField);
        return String(idField);
    };

    useEffect(() => {
        const initRoom = async () => {
            try {
                // 1. Fetch Room History
                const res = await userApi.getBiddingRoomDetails(roundId);
                if (res.data.success) {
                    const round = res.data.data.round;
                    setRoundDetails(round);

                    const actualWinnerId = extractId(round.winnerUserId);

                    if (round.status === 'PAYMENT_OPEN' || round.status === 'CLOSED' || round.status === 'FINALIZED') {
                        setRoomClosed(true);

                        if (round.status === 'FINALIZED') {
                            setIsFinalized(true);
                        }

                        if (actualWinnerId) {
                            setWinnerData({
                                winnerUserId: actualWinnerId,
                                winningBidAmount: round.winningBidAmount,
                                dividendPerMember: round.dividendPerMember,
                                payablePerMember: round.payablePerMember,
                                winnerReceivableAmount: round.winnerReceivableAmount
                            });
                        }
                    }

                    const existingBids = res.data.data.bids || [];
                    let currentMap = {};
                    let memberCounter = 1;

                    // Assign "Member X" to existing bids safely
                    existingBids.forEach(bid => {
                        const safeBidId = extractId(bid.userId);
                        if (safeBidId !== String(user._id) && !currentMap[safeBidId]) {
                            currentMap[safeBidId] = `Member ${memberCounter}`;
                            memberCounter++;
                        }
                    });

                    setMaskMap(currentMap);
                    setBids(existingBids);
                }

                // 2. Connect Socket
                const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                const newSocket = io(socketUrl);

                newSocket.emit('joinBiddingRoom', { biddingRoundId: roundId });

                newSocket.on('newBidPlaced', (newBid) => {
                    setBids(prevBids => {
                        const filtered = prevBids.filter(b => extractId(b.userId) !== extractId(newBid.userId));
                        return [...filtered, newBid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    });
                });

                newSocket.on('biddingClosed', (payload) => {
                    setRoomClosed(true);
                    if (payload && payload.winnerUserId) {
                        payload.winnerUserId = extractId(payload.winnerUserId);
                        setWinnerData(payload);
                    } else if (payload && payload.message === "Bidding time expired") {
                        setWinnerData(prev => prev ? prev : null);
                    }
                });

                // Listen for Finalize event if admin clicks it while member is in room
                newSocket.on('roundFinalized', () => {
                    setIsFinalized(true);
                    setRoomClosed(true);
                });

                setSocket(newSocket);
            } catch (err) {
                alert(err.response?.data?.message || "Failed to load bidding room.");
                navigate('/user/bidding');
            } finally {
                setLoading(false);
            }
        };

        initRoom();

        return () => {
            if (socket) socket.disconnect();
        };
        // eslint-disable-next-line
    }, [roundId, user._id, navigate]);

    useEffect(() => {
        bidsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [bids]);

    const getMaskedName = (bidUserId) => {
        const safeBidId = extractId(bidUserId);
        if (!safeBidId) return "Unknown";
        if (safeBidId === String(user._id)) return "You";

        if (!maskMap[safeBidId]) {
            const nextNum = Object.keys(maskMap).length + 1;
            setMaskMap(prev => ({ ...prev, [safeBidId]: `Member ${nextNum}` }));
            return `Member ${nextNum}`;
        }
        return maskMap[safeBidId];
    };

    const myPreviousBidObj = bids.find(b => extractId(b.userId) === String(user._id));
    const myPreviousBidAmount = myPreviousBidObj ? myPreviousBidObj.bidAmount : 0;

    const myMinimumAllowedBid = roundDetails
        ? Math.max(roundDetails.minBid, myPreviousBidAmount > 0 ? myPreviousBidAmount + roundDetails.bidMultiple : 0)
        : 0;

    const handlePlaceBid = async (e) => {
        e.preventDefault();
        const amountNum = Number(bidAmount);

        if (amountNum < myMinimumAllowedBid || amountNum > roundDetails.maxBid) {
            return alert(`Bid must be between ₹${myMinimumAllowedBid} and ₹${roundDetails.maxBid}`);
        }
        if (amountNum % roundDetails.bidMultiple !== 0) {
            return alert(`Bid must be a multiple of ₹${roundDetails.bidMultiple}`);
        }

        try {
            setSubmitting(true);
            const response = await userApi.placeBid({ biddingRoundId: roundId, bidAmount: amountNum });
            if (response.data.success) {
                setBidAmount('');
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to place bid');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    if (loading || !roundDetails) {
        return <div className="elder-bidding-container center-content"><div className="spinner"></div></div>;
    }

    const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.bidAmount)) : 0;

    if (isFinalized) {
        return (
            <div className="elder-bidding-container room-container">
                <header className="dashboard-header groups-header">
                    <div className="header-left">
                        <button className="elder-back-btn" onClick={() => navigate('/user/bidding')}>
                            <ArrowLeft size={24} /> <span>Back to Dashboard</span>
                        </button>
                    </div>
                </header>
                <main className="room-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div className="elder-empty-card" style={{ maxWidth: '500px', border: '1px solid #e2e8f0', background: 'white' }}>
                        <Calendar size={64} color="#10b981" style={{ marginBottom: '1rem' }} />
                        <h2 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>Round Finalized</h2>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '2rem' }}>
                            Month {roundDetails.monthNumber} has been successfully processed. The timeline will now move forward.
                        </p>
                        <button className="elder-btn-primary" onClick={() => navigate('/user/bidding')}>
                            Return to Bidding Hub
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="elder-bidding-container room-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/user/bidding')}>
                        <ArrowLeft size={24} /> <span>Leave Room</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">{roundDetails.groupName} - Month {roundDetails.monthNumber}</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="room-main">

                {roomClosed ? (
                    <div className="results-container" style={{ maxWidth: '600px', margin: '2rem auto' }}>
                        {!winnerData ? (
                            <div className="elder-empty-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                                <Clock size={48} color="#d97706" style={{ marginBottom: '1rem' }} className="spin-slow" />
                                <h3 style={{ color: '#92400e' }}>Bidding Closed</h3>
                                <p style={{ color: '#b45309' }}>Calculating results or awaiting admin tie resolution...</p>
                            </div>
                        ) : (
                            <div className="winner-announcement-card" style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                                <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '2rem', textAlign: 'center', color: 'white' }}>
                                    <Trophy size={56} style={{ marginBottom: '1rem' }} />
                                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Bidding Results</h2>
                                    <p style={{ margin: 0, opacity: 0.9 }}>Month {roundDetails.monthNumber} has officially concluded.</p>
                                </div>

                                <div style={{ padding: '2rem' }}>
                                    <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Winning Bidder</p>
                                        <h3 style={{ fontSize: '1.8rem', color: '#1e293b', margin: 0 }}>
                                            {getMaskedName(winnerData.winnerUserId)}
                                        </h3>
                                        <h1 style={{ color: '#059669', fontSize: '2.5rem', margin: '0.5rem 0 0 0' }}>
                                            {formatCurrency(winnerData.winningBidAmount)}
                                        </h1>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                                        <div style={{ flex: 1, background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', textAlign: 'center' }}>
                                            <p style={{ color: '#64748b', margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>Your Dividend</p>
                                            <strong style={{ color: '#2563eb', fontSize: '1.3rem' }}>{formatCurrency(winnerData.dividendPerMember)}</strong>
                                        </div>
                                        <div style={{ flex: 1, background: '#fef2f2', padding: '1.25rem', borderRadius: '16px', textAlign: 'center' }}>
                                            <p style={{ color: '#64748b', margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>{String(winnerData.winnerUserId) === String(user._id) ? "You Receive" : "You Pay"}</p>
                                            <strong style={{ color: '#dc2626', fontSize: '1.3rem' }}>
                                                {String(winnerData.winnerUserId) === String(user._id)
                                                    ? formatCurrency(winnerData.winnerReceivableAmount)
                                                    : formatCurrency(winnerData.payablePerMember)}
                                            </strong>
                                        </div>
                                    </div>

                                    <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e40af' }}>
                                        <CheckCircle size={20} />
                                        <p style={{ margin: 0, fontSize: '0.95rem' }}>Awaiting agent to initiate your physical transaction request.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="room-info-panel">
                            <div className="info-row">
                                <span><Gavel size={18} /> Limits:</span>
                                <strong>{formatCurrency(roundDetails.minBid)} - {formatCurrency(roundDetails.maxBid)}</strong>
                            </div>
                            <div className="info-row">
                                <span><Clock size={18} /> Multiples of:</span>
                                <strong>{formatCurrency(roundDetails.bidMultiple)}</strong>
                            </div>
                        </div>

                        <div className="bids-feed-container">
                            {bids.length === 0 ? (
                                <div className="elder-empty-card">No bids placed yet. Be the first!</div>
                            ) : (
                                <div className="bids-list">
                                    {bids.map((bid, index) => {
                                        const isMe = extractId(bid.userId) === String(user._id);
                                        const isHighest = bid.bidAmount === highestBid;

                                        return (
                                            <div key={index} className={`bid-bubble ${isMe ? 'my-bid' : 'other-bid'} ${isHighest ? 'highest-bid' : ''}`}>
                                                <span className="bid-name">{getMaskedName(bid.userId)} {isHighest && '👑'}</span>
                                                <span className="bid-amount">{formatCurrency(bid.bidAmount)}</span>
                                                <span className="bid-time">
                                                    {new Date(bid.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div ref={bidsEndRef} />
                                </div>
                            )}
                        </div>

                        <div className="place-bid-panel">
                            <form className="bid-form" onSubmit={handlePlaceBid}>
                                <div className="bid-input-wrapper">
                                    <IndianRupee size={24} className="input-rupee" />
                                    <input
                                        type="number"
                                        className="elder-bid-input"
                                        placeholder={`Min: ₹${myMinimumAllowedBid}`}
                                        value={bidAmount}
                                        onChange={(e) => setBidAmount(e.target.value)}
                                        min={myMinimumAllowedBid}
                                        max={roundDetails.maxBid}
                                        step={roundDetails.bidMultiple}
                                        required
                                    />
                                </div>
                                <button type="submit" className="elder-btn-primary submit-bid-btn" disabled={submitting || !bidAmount}>
                                    {submitting ? 'Placing...' : 'Place Bid'}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};

export default BiddingRoom;