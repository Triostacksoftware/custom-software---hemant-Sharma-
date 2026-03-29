import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, IndianRupee, Clock } from 'lucide-react';
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
    const [roomClosed, setRoomClosed] = useState(false);

    // Anonymization Map
    const [maskMap, setMaskMap] = useState({});
    const bidsEndRef = useRef(null);

    useEffect(() => {
        const initRoom = async () => {
            try {
                // 1. Fetch Room History
                const res = await userApi.getBiddingRoomDetails(roundId);
                if (res.data.success) {
                    setRoundDetails(res.data.data.round);

                    const existingBids = res.data.data.bids;
                    let currentMap = {};
                    let memberCounter = 1;

                    // Assign "Member X" to existing bids
                    existingBids.forEach(bid => {
                        if (String(bid.userId) !== String(user._id) && !currentMap[bid.userId]) {
                            currentMap[bid.userId] = `Member ${memberCounter}`;
                            memberCounter++;
                        }
                    });

                    setMaskMap(currentMap);
                    setBids(existingBids);
                }

                // 2. Connect Socket
                // NOTE: Replace with your actual backend URL if deployed!
                const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                const newSocket = io(socketUrl);

                newSocket.emit('joinBiddingRoom', { biddingRoundId: roundId });

                newSocket.on('newBidPlaced', (newBid) => {
                    setBids(prevBids => {
                        // Remove older bid by same user if exists, then append new
                        const filtered = prevBids.filter(b => String(b.userId) !== String(newBid.userId));
                        return [...filtered, newBid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    });
                });

                newSocket.on('biddingClosed', () => {
                    setRoomClosed(true);
                    alert("Bidding time has expired. The room is now closed.");
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

    // Auto-scroll to bottom of chat when new bid arrives
    useEffect(() => {
        bidsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [bids]);

    // Anonymize Name Helper
    const getMaskedName = (bidUserId) => {
        if (String(bidUserId) === String(user._id)) return "You";

        if (!maskMap[bidUserId]) {
            const nextNum = Object.keys(maskMap).length + 1;
            setMaskMap(prev => ({ ...prev, [bidUserId]: `Member ${nextNum}` }));
            return `Member ${nextNum}`;
        }
        return maskMap[bidUserId];
    };

    // Calculate dynamic limits for the current user
    const myPreviousBidObj = bids.find(b => String(b.userId) === String(user._id));
    const myPreviousBidAmount = myPreviousBidObj ? myPreviousBidObj.bidAmount : 0;

    // UI Validation: Input minimum must be either the global minBid, OR their previous bid + 1 step
    const myMinimumAllowedBid = roundDetails
        ? Math.max(roundDetails.minBid, myPreviousBidAmount > 0 ? myPreviousBidAmount + roundDetails.bidMultiple : 0)
        : 0;

    const handlePlaceBid = async (e) => {
        e.preventDefault();
        const amountNum = Number(bidAmount);

        // Frontend Validation (matches backend logic)
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

    return (
        <div className="elder-bidding-container room-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/user/bidding')}>
                        <ArrowLeft size={24} /> <span>Leave Room</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">{roundDetails.groupName}</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="room-main">
                {/* Room Rules Panel */}
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

                {/* Bids Chat Feed */}
                <div className="bids-feed-container">
                    {bids.length === 0 ? (
                        <div className="elder-empty-card">No bids placed yet. Be the first!</div>
                    ) : (
                        <div className="bids-list">
                            {bids.map((bid, index) => {
                                const isMe = String(bid.userId) === String(user._id);
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

                {/* Input Form Panel */}
                <div className="place-bid-panel">
                    {roomClosed || roundDetails.status === 'CLOSED' ? (
                        <div className="room-closed-alert">This bidding round is now closed.</div>
                    ) : (
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
                    )}
                </div>
            </main>
        </div>
    );
};

export default BiddingRoom;