import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, StopCircle, Trophy, AlertTriangle, User, Clock, CheckCircle, Calendar, Info, XCircle } from 'lucide-react';
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

    // Update Terms Form State
    const [termsForm, setTermsForm] = useState({ minBid: '', maxBid: '', bidMultiple: '', updateGroupDefaults: false });

    // Tie Resolution State
    const [tiedUsers, setTiedUsers] = useState([]);

    // --- NEW: Custom Modal States ---
    const [confirmModal, setConfirmModal] = useState({ show: false, action: null, payload: null, title: '', message: '', btnText: '', btnColor: '' });
    const [infoModal, setInfoModal] = useState({ show: false, title: '', message: '', isError: false, redirectOnClose: false });

    const fetchData = async () => {
        try {
            const groupRes = await adminApi.groups.details(groupId);
            if (groupRes.data.success) {
                setGroupData(groupRes.data.data.group);
            }

            const roundRes = await adminApi.bidding.getCurrentRound(groupId);
            if (roundRes.data.success) {
                setRoundData(roundRes.data.data);

                if (roundRes.data.data && (roundRes.data.data.status === 'OPEN' || roundRes.data.data.status === 'CLOSED')) {
                    const bidsRes = await adminApi.bidding.getBids(roundRes.data.data._id);
                    if (bidsRes.data.success) {
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

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    // SOCKET CONNECTION FOR LIVE BIDS
    useEffect(() => {
        if (!roundData || !roundData._id) return;

        const socketUrl = process.env.REACT_APP_API_URL;
        const newSocket = io(socketUrl);

        newSocket.emit('joinBiddingRoom', { biddingRoundId: roundData._id });

        newSocket.on('newBidPlaced', () => {
            adminApi.bidding.getBids(roundData._id)
                .then(res => {
                    if (res.data.success) {
                        setBids(res.data.data.sort((a, b) => b.bidAmount - a.bidAmount));
                    }
                })
                .catch(err => console.error("Live fetch error:", err));
        });

        newSocket.on('biddingClosed', (data) => {
            fetchData(); // Refresh the database state

            if (data && data.tie) {
                // If the backend says it's a tie, save the tied users to state!
                setTiedUsers(data.tiedUsers);

                setInfoModal({
                    show: true,
                    title: 'Tie Detected!',
                    message: 'Bidding closed and Tie detected. Please resolve the tie below.',
                    isError: false
                });
            } else {
                // Single winner or no bids
                setInfoModal({
                    show: true,
                    title: 'Bidding Time Expired',
                    message: 'The scheduled time has ended. The room is now closed automatically.',
                    isError: false
                });
            }
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [roundData?._id]);

    useEffect(() => {
        if (roundData && roundData.status === 'PENDING') {
            setTermsForm({
                minBid: roundData.minBid || '',
                maxBid: roundData.maxBid || '',
                bidMultiple: roundData.bidMultiple || '',
                updateGroupDefaults: false
            });
        }
    }, [roundData]);

    const handleUpdateTerms = async (e) => {
        e.preventDefault();

        if (Number(termsForm.minBid) >= Number(termsForm.maxBid)) {
            setInfoModal({ show: true, title: 'Invalid Limits', message: 'Minimum bid must be strictly less than the maximum bid.', isError: true });
            return;
        }

        setActionLoading(true);
        try {
            const res = await adminApi.bidding.updateTerms(roundData._id, {
                minBid: Number(termsForm.minBid),
                maxBid: Number(termsForm.maxBid),
                bidMultiple: Number(termsForm.bidMultiple),
                updateGroupDefaults: termsForm.updateGroupDefaults
            });

            setInfoModal({ show: true, title: 'Success', message: res.data.message, isError: false });
            fetchData();
        } catch (err) {
            setInfoModal({ show: true, title: 'Update Failed', message: err.response?.data?.message || 'Failed to update bidding terms.', isError: true });
        } finally {
            setActionLoading(false);
        }
    };

    // --- Action Prompts ---
    const promptCloseBidding = () => {
        setConfirmModal({
            show: true, action: 'CLOSE', payload: null,
            title: 'Close Bidding Window?',
            message: 'Are you sure you want to manually close this bidding round? No more bids will be accepted.',
            btnText: 'Yes, Close Bidding', btnColor: 'btn-danger-fill'
        });
    };

    const promptResolveTie = (winnerUserId) => {
        setConfirmModal({
            show: true, action: 'RESOLVE_TIE', payload: winnerUserId,
            title: 'Confirm Winner',
            message: 'Are you sure you want to select this member as the winner of the tie?',
            btnText: 'Confirm Winner', btnColor: 'btn-success-fill'
        });
    };

    const promptFinalize = () => {
        setConfirmModal({
            show: true, action: 'FINALIZE', payload: null,
            title: 'Finalize Month?',
            message: 'This will close the payment phase and advance the group to the next month. Ensure all dues are cleared.',
            btnText: 'Yes, Finalize Month', btnColor: 'btn-primary-fill'
        });
    };

    // --- Execute Confirmed Action ---
    const executeAction = async () => {
        const { action, payload } = confirmModal;
        setConfirmModal({ ...confirmModal, show: false }); // Hide confirm dialog
        setActionLoading(true);

        try {
            if (action === 'CLOSE') {
                const res = await adminApi.bidding.close({ biddingRoundId: roundData._id });
                if (res.data.tie) {
                    setInfoModal({ show: true, title: 'Tie Detected!', message: 'Bidding closed successfully, but multiple users placed the highest bid. Please resolve the tie below.', isError: false });
                    setTiedUsers(res.data.tiedUsers);
                } else {
                    setInfoModal({ show: true, title: 'Bidding Closed', message: 'The bidding round has been closed. The payment phase is now active.', isError: false });
                }
            }
            else if (action === 'RESOLVE_TIE') {
                await adminApi.bidding.resolveTie({ biddingRoundId: roundData._id, winnerUserId: payload });
                setTiedUsers([]);
                setInfoModal({ show: true, title: 'Tie Resolved', message: 'The winner has been successfully recorded. Payment phase is now active.', isError: false });
            }
            else if (action === 'FINALIZE') {
                await adminApi.bidding.finalize({ biddingRoundId: roundData._id });
                setInfoModal({ show: true, title: 'Month Finalized!', message: 'Group has been advanced to the next month successfully.', isError: false, redirectOnClose: true });
            }

            fetchData();
        } catch (err) {
            setInfoModal({ show: true, title: 'Action Failed', message: err.response?.data?.message || 'An error occurred while processing.', isError: true });
        } finally {
            setActionLoading(false);
        }
    };

    const handleInfoClose = () => {
        setInfoModal({ ...infoModal, show: false });
        if (infoModal.redirectOnClose) {
            navigate('/admin/bidding');
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    const formatScheduleDate = (dateString) => {
        if (!dateString) return "Date not set";
        return new Date(dateString).toLocaleString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

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

                        {/* ADMIN ROUND OVERRIDE */}
                        {roundData?.isAdminRound ? (
                            <div className="action-box admin-box">
                                <h4>Admin Round (Month 1)</h4>
                                <p>No bidding occurs in the first month. The full pool is allocated to the platform/admin.</p>
                            </div>
                        ) : (
                            <>
                                {/* UPDATE TERMS FORM (Only visible when PENDING) */}
                                {roundData?.status === 'PENDING' && (
                                    <div className="action-box setup-box">

                                        <div className="scheduled-banner">
                                            <div className="scheduled-icon">
                                                <Calendar size={28} />
                                            </div>
                                            <div className="scheduled-info">
                                                <div className="scheduled-header-row">
                                                    <p className="scheduled-label">Bidding Scheduled For</p>
                                                    {roundData.usingDefaultTerms ? (
                                                        <span className="terms-badge badge-default"><CheckCircle size={12} /> Default Terms</span>
                                                    ) : (
                                                        <span className="terms-badge badge-custom"><Settings size={12} /> Custom Terms</span>
                                                    )}
                                                </div>
                                                <h4 className="scheduled-date">
                                                    {formatScheduleDate(roundData.scheduledBiddingDate)}
                                                </h4>
                                            </div>
                                        </div>

                                        <h4><Settings size={20} /> Update Bidding Terms</h4>
                                        <p className="setup-hint">
                                            The round will open automatically at the scheduled time. You can override the default constraints before it starts.
                                        </p>

                                        <div className="default-terms-info">
                                            <Info size={16} />
                                            <span>
                                                <strong>Default Terms:</strong> Min {formatCurrency(roundData.defaultBidTerms?.minBid)} &nbsp;|&nbsp; Max {formatCurrency(roundData.defaultBidTerms?.maxBid)} &nbsp;|&nbsp; Step {formatCurrency(roundData.defaultBidTerms?.bidMultiple)}
                                            </span>
                                        </div>

                                        <form onSubmit={handleUpdateTerms}>
                                            <div className="form-group">
                                                <label>Min Bid Allowed (₹)</label>
                                                <input type="number" value={termsForm.minBid} onChange={e => setTermsForm({ ...termsForm, minBid: e.target.value })} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Max Bid Allowed (₹)</label>
                                                <input type="number" value={termsForm.maxBid} onChange={e => setTermsForm({ ...termsForm, maxBid: e.target.value })} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Bid Multiple (₹)</label>
                                                <input type="number" value={termsForm.bidMultiple} onChange={e => setTermsForm({ ...termsForm, bidMultiple: e.target.value })} required />
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', marginTop: '0.5rem' }}>
                                                <input
                                                    type="checkbox"
                                                    id="updateDefaults"
                                                    checked={termsForm.updateGroupDefaults}
                                                    onChange={(e) => setTermsForm({ ...termsForm, updateGroupDefaults: e.target.checked })}
                                                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                                />
                                                <label htmlFor="updateDefaults" style={{ margin: 0, fontSize: '0.9rem', color: '#334155', cursor: 'pointer' }}>
                                                    Save as default for future months
                                                </label>
                                            </div>

                                            <button type="submit" className="elder-btn-primary full-width" disabled={actionLoading}>
                                                {actionLoading ? 'Updating...' : 'Update Terms'}
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {roundData?.status === 'OPEN' && (
                                    <div className="action-box live-box">
                                        <div className="live-indicator"><span className="pulse-dot bg-red"></span> Bidding is Live</div>
                                        <p>Members are currently placing bids. Close the window when ready.</p>
                                        <button className="elder-btn-danger-solid full-width" onClick={promptCloseBidding} disabled={actionLoading}>
                                            <StopCircle size={20} /> Close Bidding Window
                                        </button>
                                    </div>
                                )}

                                {roundData?.status === 'CLOSED' && tiedUsers.length > 0 && (
                                    <div className="action-box tie-box">
                                        <div className="tie-box-header">
                                            <AlertTriangle size={24} className="text-amber" />
                                            <h4>Tie Detected!</h4>
                                        </div>
                                        <p>Multiple members placed the highest bid of <strong>{formatCurrency(tiedUsers[0].bidAmount)}</strong>. Please conduct an offline draw and select the winner below.</p>
                                        <div className="tie-list">
                                            {tiedUsers.map(user => (
                                                <div key={user.userId} className="tie-row">
                                                    <div className="tie-row-info">
                                                        <div className="feed-avatar"><User size={16} /></div>
                                                        <span title={user.name}>{user.name}</span>
                                                    </div>
                                                    <button className="elder-btn-primary" onClick={() => promptResolveTie(user.userId)} disabled={actionLoading}>
                                                        Select Winner
                                                    </button>
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
                                        <button className="elder-btn-primary full-width mt-1" onClick={promptFinalize} disabled={actionLoading}>
                                            Finalize Month
                                        </button>
                                        <p className="final-hint">Ensure all collections/payouts are marked COMPLETED before finalizing.</p>
                                    </div>
                                )}
                            </>
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

            {/* --- 1. Custom Confirmation Modal --- */}
            {confirmModal.show && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-card confirm-dialog-card">
                        <div className={`confirm-icon-wrapper ${confirmModal.action === 'CLOSE' ? 'bg-red-light text-red' : 'bg-blue-light text-blue'}`}>
                            {confirmModal.action === 'CLOSE' ? <AlertTriangle size={36} /> : <Info size={36} />}
                        </div>
                        <h3>{confirmModal.title}</h3>
                        <p>{confirmModal.message}</p>

                        <div className="modal-actions" style={{ marginTop: '1.5rem', width: '100%' }}>
                            <button
                                className="elder-btn-secondary"
                                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                disabled={actionLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className={`elder-btn-primary ${confirmModal.btnColor}`}
                                onClick={executeAction}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Processing...' : confirmModal.btnText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 2. Custom Success/Error Info Modal --- */}
            {infoModal.show && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-card confirm-dialog-card">
                        <div className={`confirm-icon-wrapper ${infoModal.isError ? 'bg-red-light text-red' : 'bg-emerald-light text-emerald'}`}>
                            {infoModal.isError ? <XCircle size={36} /> : <CheckCircle size={36} />}
                        </div>
                        <h3>{infoModal.title}</h3>
                        <p>{infoModal.message}</p>

                        <div className="modal-actions" style={{ marginTop: '1.5rem', width: '100%' }}>
                            <button
                                className={`elder-btn-primary full-width ${infoModal.isError ? 'btn-danger-fill' : 'btn-success-fill'}`}
                                onClick={handleInfoClose}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default BiddingRoom;