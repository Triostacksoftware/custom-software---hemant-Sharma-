import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, PlayCircle, StopCircle, Trophy, AlertTriangle, User, Clock, CheckCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { adminApi } from '../../api/adminApi';
import './Bidding.css';

const BiddingRoom = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [groupData, setGroupData] = useState(null);
    const [roundData, setRoundData] = useState(null);
    const [bids, setBids] = useState([]);
    const [socket, setSocket] = useState(null);

    // Open Bidding Form State
    const [openForm, setOpenForm] = useState({ minBid: '', maxBid: '', bidMultiple: '' });

    // Tie Resolution State
    const [tiedUsers, setTiedUsers] = useState([]);

    const fetchData = async () => {
        try {
            // Fetch group details to get baseline stats (pool size, etc.)
            const groupRes = await adminApi.groups.details(groupId);
            if (groupRes.data.success) {
                setGroupData(groupRes.data.data.group);
            }

            // Fetch current round status
            const roundRes = await adminApi.bidding.getCurrentRound(groupId);
            if (roundRes.data.success) {
                setRoundData(roundRes.data.data);

                // If round exists and is OPEN or CLOSED, fetch bids
                if (roundRes.data.data && (roundRes.data.data.status === 'OPEN' || roundRes.data.data.status === 'CLOSED')) {
                    const bidsRes = await adminApi.bidding.getBids(roundRes.data.data._id);
                    if (bidsRes.data.success) {
                        // Sort highest first for display
                        setBids(bidsRes.data.data.sort((a, b) => b.bidAmount - a.bidAmount));
                    }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    // SOCKET CONNECTION FOR LIVE BIDS
    useEffect(() => {
        // Only connect if the round exists and we have its ID
        if (!roundData || !roundData._id) return;

        const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const newSocket = io(socketUrl);

        // Join the exact same room the members are in
        newSocket.emit('joinBiddingRoom', { biddingRoundId: roundData._id });

        // Listen for new bids
        newSocket.on('newBidPlaced', () => {
            // Silently re-fetch bids so we get the populated user names from the DB
            adminApi.bidding.getBids(roundData._id)
                .then(res => {
                    if (res.data.success) {
                        setBids(res.data.data.sort((a, b) => b.bidAmount - a.bidAmount));
                    }
                })
                .catch(err => console.error("Live fetch error:", err));
        });

        // Listen for closing events
        newSocket.on('biddingClosed', () => {
            fetchData(); // Refresh to update status to CLOSED
            alert("Bidding time has expired. The room is now closed.");
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [roundData?._id]);

    // Calculate Defaults for Form when groupData loads
    useEffect(() => {
        if (groupData && (!roundData || roundData.status === 'PENDING')) {
            const pool = groupData.monthlyContribution * groupData.totalMembers;
            setOpenForm({
                minBid: pool * 0.05, // 5% default (Adjusted slightly for broader options)
                maxBid: pool * 0.30, // 30% default
                bidMultiple: 100     // 100 default
            });
        }
    }, [groupData, roundData]);

    const handleOpenBidding = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await adminApi.bidding.open({
                groupId,
                minBid: Number(openForm.minBid),
                maxBid: Number(openForm.maxBid),
                bidMultiple: Number(openForm.bidMultiple)
            });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Failed to open bidding");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCloseBidding = async () => {
        if (!window.confirm("Are you sure you want to close this bidding round? No more bids will be accepted.")) return;
        setActionLoading(true);
        try {
            const res = await adminApi.bidding.close({ biddingRoundId: roundData._id });
            if (res.data.tie) {
                alert("Bidding closed, but a tie occurred! Please resolve it.");
                setTiedUsers(res.data.tiedUsers);
            } else {
                alert("Bidding closed successfully.");
            }
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Failed to close bidding");
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolveTie = async (winnerUserId) => {
        if (!window.confirm("Confirm this user as the winner?")) return;
        setActionLoading(true);
        try {
            await adminApi.bidding.resolveTie({ biddingRoundId: roundData._id, winnerUserId });
            setTiedUsers([]);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Failed to resolve tie");
        } finally {
            setActionLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!window.confirm("Finalize round? This will advance the group to the next month.")) return;
        setActionLoading(true);
        try {
            await adminApi.bidding.finalize({ biddingRoundId: roundData._id });
            fetchData();
            alert("Month finalized successfully!");
            navigate('/admin/bidding');
        } catch (err) {
            alert(err.response?.data?.message || "Cannot finalize. Make sure all members have completed their payments.");
        } finally {
            setActionLoading(false);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    if (loading) return <div className="admin-bidding-container center-content"><div className="spinner"></div></div>;
    if (!groupData) return <div className="admin-bidding-container center-content"><p>Group not found.</p></div>;

    const totalPool = groupData.monthlyContribution * groupData.totalMembers;

    return (
        <div className="admin-bidding-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/bidding')}><ArrowLeft size={24} /> <span>Back</span></button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">{groupData.name} - Control Room</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="bidding-main-content room-layout">

                {/* Left Panel: Controls */}
                <div className="room-controls-panel">

                    <div className="room-status-card">
                        <h3>Current Status: Month {groupData.currentMonth}</h3>
                        <div className="pool-highlight">
                            <span>Total Pool Amount</span>
                            <h2>{formatCurrency(totalPool)}</h2>
                        </div>

                        {/* FIX: Show Setup Form if roundData doesn't exist OR if it is PENDING */}
                        {(!roundData || roundData.status === 'PENDING') && groupData.currentMonth > 1 && (
                            <div className="action-box setup-box">
                                <h4><PlayCircle size={20} /> Setup Bidding Round</h4>
                                <form onSubmit={handleOpenBidding}>
                                    <div className="form-group">
                                        <label>Min Bid Allowed (₹)</label>
                                        <input type="number" value={openForm.minBid} onChange={e => setOpenForm({ ...openForm, minBid: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Max Bid Allowed (₹)</label>
                                        <input type="number" value={openForm.maxBid} onChange={e => setOpenForm({ ...openForm, maxBid: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Bid Multiple (₹)</label>
                                        <input type="number" value={openForm.bidMultiple} onChange={e => setOpenForm({ ...openForm, bidMultiple: e.target.value })} required />
                                    </div>
                                    <button type="submit" className="elder-btn-success-solid full-width" disabled={actionLoading}>
                                        {actionLoading ? 'Opening...' : 'Start Bidding Now'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {roundData?.status === 'OPEN' && (
                            <div className="action-box live-box">
                                <div className="live-indicator"><span className="pulse-dot bg-red"></span> Bidding is Live</div>
                                <p>Members are currently placing bids. Close the window when ready.</p>
                                <button className="elder-btn-danger-solid full-width" onClick={handleCloseBidding} disabled={actionLoading}>
                                    <StopCircle size={20} /> Close Bidding Window
                                </button>
                            </div>
                        )}

                        {roundData?.status === 'CLOSED' && tiedUsers.length > 0 && (
                            <div className="action-box tie-box">
                                <h4><AlertTriangle size={20} /> Tie Detected!</h4>
                                <p>Multiple members placed the highest bid of <strong>{formatCurrency(tiedUsers[0].bidAmount)}</strong>. Please conduct an offline draw and select the winner below.</p>
                                <div className="tie-list">
                                    {tiedUsers.map(user => (
                                        <div key={user.userId} className="tie-row">
                                            <span>{user.name}</span>
                                            <button className="elder-btn-primary" onClick={() => handleResolveTie(user.userId)} disabled={actionLoading}>Select</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {roundData?.status === 'PAYMENT_OPEN' && (
                            <div className="action-box final-box">
                                <h4><CheckCircle size={20} /> Payment Phase Active</h4>
                                <p>Winner: <strong>{roundData.winnerName}</strong></p>
                                <div className="fin-summary-mini">
                                    <div><span>Winner Receives:</span> <strong>{formatCurrency(roundData.winnerReceivableAmount)}</strong></div>
                                    <div><span>Others Pay:</span> <strong>{formatCurrency(roundData.payablePerMember)} /ea</strong></div>
                                </div>
                                <button className="elder-btn-primary full-width mt-1" onClick={handleFinalize} disabled={actionLoading}>
                                    Finalize Month
                                </button>
                                <p className="final-hint">Ensure all collections/payouts are marked COMPLETED before finalizing.</p>
                            </div>
                        )}

                        {groupData.currentMonth === 1 && (
                            <div className="action-box admin-box">
                                <h4>Admin Round (Month 1)</h4>
                                <p>No bidding occurs in the first month. The full pool is allocated to the platform/admin.</p>
                            </div>
                        )}

                    </div>
                </div>

                {/* Right Panel: Live Feed */}
                <div className="room-feed-panel">
                    <h3>Live Bid Feed <span className="bid-count">({bids.length} Bids)</span></h3>

                    <div className="feed-container">
                        {bids.length === 0 ? (
                            <div className="feed-empty">
                                <Clock size={40} opacity={0.3} />
                                <p>No bids placed yet.</p>
                            </div>
                        ) : (
                            bids.map((bid, idx) => (
                                <div key={idx} className={`feed-row ${idx === 0 ? 'highest-bid' : ''}`}>
                                    <div className="feed-user">
                                        <div className="feed-avatar"><User size={16} /></div>
                                        <span>{bid.name}</span>
                                    </div>
                                    <div className="feed-amount">
                                        {idx === 0 && <Trophy size={16} className="text-gold" />}
                                        <strong>{formatCurrency(bid.bidAmount)}</strong>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
};

export default BiddingRoom;