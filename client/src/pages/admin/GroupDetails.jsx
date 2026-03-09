import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { adminApi } from '../../api/adminApi';
import {
    ArrowLeft,
    Calendar,
    Users,
    IndianRupeeIcon,
    Clock,
    Activity,
    X,
    UserPlus,
    Search,
    Play,
    Award,
    TrendingUp,
    CheckCircle,
    AlertCircle,
    Loader
} from 'lucide-react';
import './GroupDetails.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const GroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Bidding state
    const [biddingRound, setBiddingRound] = useState(null);
    const [bids, setBids] = useState([]);
    const [loadingBidding, setLoadingBidding] = useState(false);
    const [biddingError, setBiddingError] = useState('');
    const [biddingSuccess, setBiddingSuccess] = useState('');
    const [socket, setSocket] = useState(null);

    // Pending members shown when finalize is blocked
    // Shape: [{ name, phoneNumber, type, required, paid, remaining }]
    const [finalizePendingMembers, setFinalizePendingMembers] = useState([]);

    // Tie resolution state
    const [tieModalOpen, setTieModalOpen] = useState(false);
    const [tiedUsers, setTiedUsers] = useState([]);
    const [selectedWinner, setSelectedWinner] = useState(null);
    const [resolvingTie, setResolvingTie] = useState(false);

    // Add member modal state
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [addingUserId, setAddingUserId] = useState(null);

    // Activate group state
    const [activating, setActivating] = useState(false);

    // General success message
    const [successMessage, setSuccessMessage] = useState('');

    // History modal state
    const [selectedMember, setSelectedMember] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    useEffect(() => {
        fetchGroupDetails();
    }, [groupId]);

    useEffect(() => {
        if (groupData) {
            fetchCurrentBiddingRound();
        }
    }, [groupData]);

    // Socket connection when bidding round is OPEN
    useEffect(() => {
        if (biddingRound && biddingRound.status === 'OPEN') {
            const newSocket = io(SOCKET_URL);
            setSocket(newSocket);

            newSocket.on('connect', () => {
                newSocket.emit('joinBiddingRoom', { biddingRoundId: biddingRound._id });
                fetchBids(biddingRound._id);
            });

            newSocket.on('newBidPlaced', (bid) => {
                setBids(prev => {
                    const exists = prev.some(
                        b => b.userId === bid.userId && b.timestamp === bid.timestamp
                    );
                    if (exists) return prev;
                    return [...prev, bid];
                });
            });

            newSocket.on('biddingClosed', (data) => {
                setBiddingRound(prev => ({ ...prev, status: 'CLOSED' }));
                setBiddingSuccess(data.message || 'Bidding closed');
                fetchCurrentBiddingRound();
            });

            return () => { newSocket.disconnect(); };
        } else {
            setBids([]);
        }
    }, [biddingRound]);

    const fetchGroupDetails = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await adminApi.groups.details(groupId);
            setGroupData(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch group details');
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentBiddingRound = async () => {
        try {
            setLoadingBidding(true);
            const response = await adminApi.bidding.getCurrentRound(groupId);
            setBiddingRound(response.data.data);
        } catch (err) {
            if (err.response?.status !== 404) {
                console.error('Failed to fetch bidding round:', err);
            }
            setBiddingRound(null);
        } finally {
            setLoadingBidding(false);
        }
    };

    const fetchBids = async (roundId) => {
        try {
            const response = await adminApi.bidding.getBids(roundId);
            setBids(response.data.data || []);
        } catch (err) {
            console.error('Failed to fetch bids:', err);
        }
    };

    const handleOpenBidding = async () => {
        try {
            setBiddingError('');
            setBiddingSuccess('');
            setFinalizePendingMembers([]);
            await adminApi.bidding.open(groupId);
            setBiddingSuccess('Bidding opened successfully!');
            fetchCurrentBiddingRound();
        } catch (err) {
            setBiddingError(err.response?.data?.message || 'Failed to open bidding');
        }
    };

    const handleCloseBidding = async () => {
        if (!biddingRound) return;
        try {
            setBiddingError('');
            setBiddingSuccess('');
            setFinalizePendingMembers([]);
            const response = await adminApi.bidding.close(biddingRound._id);
            if (response.data.tie) {
                setTiedUsers(response.data.tiedUsers);
                setTieModalOpen(true);
            } else {
                setBiddingSuccess('Bidding closed successfully!');
                fetchCurrentBiddingRound();
            }
        } catch (err) {
            setBiddingError(err.response?.data?.message || 'Failed to close bidding');
        }
    };

    const handleResolveTie = async () => {
        if (!selectedWinner || !biddingRound) return;
        setResolvingTie(true);
        try {
            await adminApi.bidding.resolveTie(biddingRound._id, selectedWinner);
            setTieModalOpen(false);
            setBiddingSuccess('Tie resolved successfully!');
            fetchCurrentBiddingRound();
        } catch (err) {
            setBiddingError(err.response?.data?.message || 'Failed to resolve tie');
        } finally {
            setResolvingTie(false);
        }
    };

    const handleFinalizeBidding = async () => {
        if (!biddingRound) return;

        // Clear previous finalize feedback before retrying
        setBiddingError('');
        setBiddingSuccess('');
        setFinalizePendingMembers([]);

        try {
            await adminApi.bidding.finalize(biddingRound._id);
            setBiddingSuccess('Bidding finalized and group moved to next month!');
            fetchGroupDetails();
            fetchCurrentBiddingRound();
        } catch (err) {
            const data = err.response?.data;

            // Show the generic error message
            setBiddingError(data?.message || 'Failed to finalize bidding');

            // If the backend returned a list of members with incomplete payments,
            // display them so the admin knows exactly who is still pending.
            if (data?.pendingMembers?.length) {
                setFinalizePendingMembers(data.pendingMembers);
            }
        }
    };

    const handleActivateGroup = async () => {
        if (!window.confirm('Are you sure you want to activate this group? This action cannot be undone.')) {
            return;
        }
        setActivating(true);
        try {
            await adminApi.groups.activate(groupId);
            setSuccessMessage('Group activated successfully!');
            fetchGroupDetails();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to activate group');
        } finally {
            setActivating(false);
        }
    };

    const openAddMemberModal = async () => {
        setShowAddMemberModal(true);
        setUserSearchTerm('');
        setAvailableUsers([]);
        setLoadingUsers(true);
        try {
            const response = await adminApi.users.fetchAll({ limit: 100 });
            const allUsers = response.data.data.members || [];
            const currentMemberIds = members.map(m => m.userId);
            const eligible = allUsers.filter(
                user =>
                    user.approvalStatus === 'APPROVED' &&
                    !currentMemberIds.includes(user._id)
            );
            setAvailableUsers(eligible);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleAddMember = async (userId) => {
        setAddingUserId(userId);
        try {
            await adminApi.groups.addMember(groupId, userId);
            await fetchGroupDetails();
            setSuccessMessage('Member added successfully!');
            setShowAddMemberModal(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add member');
        } finally {
            setAddingUserId(null);
        }
    };

    const openHistoryModal = (member) => { setSelectedMember(member); setShowHistoryModal(true); };
    const closeHistoryModal = () => { setShowHistoryModal(false); setSelectedMember(null); };

    const formatCurrency = (amount) => {
        if (amount == null || amount === '') return '₹0';
        const num = Number(amount);
        if (isNaN(num)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR',
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(num);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const getStatusBadgeClass = (status) => `status-badge ${status?.toLowerCase()}`;
    const getBiddingStatusClass = (status) => `bidding-status ${status?.toLowerCase().replace('_', '-')}`;

    if (loading) {
        return (
            <div className="group-details-loading">
                <div className="spinner"></div>
                <p>Loading group details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="group-details-error">
                <strong>Error:</strong> {error}
                <button onClick={fetchGroupDetails}>Retry</button>
            </div>
        );
    }

    if (!groupData) return null;

    const { group, financialSummary, members } = groupData;
    const isDraft = group.status === 'DRAFT';
    const isFull = members.length === group.totalMembers;

    const filteredUsers = availableUsers.filter(user =>
        user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.phoneNumber.includes(userSearchTerm)
    );

    return (
        <div className="group-details-page">

            {/* ── Global feedback messages ── */}
            {successMessage && (
                <div className="success-message">{successMessage}</div>
            )}
            {biddingSuccess && (
                <div className="success-message">{biddingSuccess}</div>
            )}
            {biddingError && (
                <div className="error-message">
                    <AlertCircle size={18} /> {biddingError}
                </div>
            )}

            {/* ── Pending members panel — shown when finalize is blocked ── */}
            {finalizePendingMembers.length > 0 && (
                <div className="finalize-pending-panel">
                    <div className="finalize-pending-header">
                        <AlertCircle size={18} />
                        <strong>Payments incomplete — finalization blocked</strong>
                    </div>
                    <p className="finalize-pending-subtitle">
                        The following members have not completed their payments for this month:
                    </p>
                    <table className="finalize-pending-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Paid</th>
                                <th>Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalizePendingMembers.map((m, idx) => (
                                <tr key={idx}>
                                    <td>{m.name}</td>
                                    <td>{m.phoneNumber || '—'}</td>
                                    <td>
                                        <span className={`type-badge ${m.type === 'WINNER_PAYOUT' ? 'payout' : 'contribution'}`}>
                                            {m.type === 'WINNER_PAYOUT' ? 'Payout' : 'Contribution'}
                                        </span>
                                    </td>
                                    <td>{formatCurrency(m.required)}</td>
                                    <td>{formatCurrency(m.paid)}</td>
                                    <td className="remaining-cell">
                                        {formatCurrency(m.remaining)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Header ── */}
            <div className="group-details-header">
                <button className="back-btn" onClick={() => navigate('/admin/groups')}>
                    <ArrowLeft size={18} /> Back to Groups
                </button>
                <h1 className="page-title">{group.name}</h1>
                <div className="header-actions">
                    <span className={getStatusBadgeClass(group.status)}>{group.status}</span>
                    {isDraft && !isFull && (
                        <button className="add-member-btn" onClick={openAddMemberModal}>
                            <UserPlus size={18} /> Add Member
                        </button>
                    )}
                    {isDraft && isFull && (
                        <button
                            className="activate-btn"
                            onClick={handleActivateGroup}
                            disabled={activating}
                        >
                            {activating
                                ? <><Loader size={18} className="spinner" /> Activating...</>
                                : <><Play size={18} /> Activate Group</>}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Info Cards ── */}
            <div className="info-cards">
                <div className="info-card">
                    <div className="info-icon"><Calendar size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Members</span>
                        <span className="info-value">{members.length} / {group.totalMembers}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><Clock size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Current Month</span>
                        <span className="info-value">{group.currentMonth} / {group.totalMonths}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><IndianRupeeIcon size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Monthly Contribution</span>
                        <span className="info-value">{formatCurrency(group.monthlyContribution)}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><TrendingUp size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Collected This Month</span>
                        <span className="info-value">{formatCurrency(financialSummary.currentMonthCollection)}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><Award size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Total Collected</span>
                        <span className="info-value">{formatCurrency(financialSummary.totalCollected)}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><IndianRupeeIcon size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Total Pool</span>
                        <span className="info-value">{formatCurrency(group.totalMembers * group.monthlyContribution)}</span>
                    </div>
                </div>
            </div>

            {/* ── Bidding Section (ACTIVE groups only) ── */}
            {group.status === 'ACTIVE' && (
                <div className="bidding-section">
                    <h2 className="section-title">Bidding Management</h2>

                    {loadingBidding ? (
                        <div className="loading-spinner">
                            <Loader size={20} className="spinner" /> Loading bidding info...
                        </div>
                    ) : biddingRound ? (
                        <div className="bidding-info">
                            <div className="bidding-header">
                                <span className={getBiddingStatusClass(biddingRound.status)}>
                                    {biddingRound.status}
                                </span>
                                <span className="bidding-month">Month {biddingRound.monthNumber}</span>
                            </div>

                            <div className="bidding-details">

                                {/* ── OPEN ── */}
                                {biddingRound.status === 'OPEN' && (
                                    <>
                                        <p><strong>Started:</strong> {formatDate(biddingRound.startedAt)}</p>
                                        <p><strong>Ends:</strong>   {formatDate(biddingRound.endedAt)}</p>
                                        <p><strong>Bids placed:</strong> {biddingRound.bidsCount}</p>

                                        <div className="live-bidding admin">
                                            <h3>Live Bids</h3>
                                            <div className="bid-feed">
                                                {bids.length === 0 ? (
                                                    <p className="no-bids">No bids yet.</p>
                                                ) : (
                                                    bids.map((bid, idx) => (
                                                        <div key={idx} className="bid-message">
                                                            <span className="bidder">{bid.name}</span>
                                                            <span className="bid-amount">{formatCurrency(bid.bidAmount)}</span>
                                                            <span className="bid-time">{formatDate(bid.timestamp)}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <button className="action-btn close" onClick={handleCloseBidding}>
                                            Close Bidding
                                        </button>
                                    </>
                                )}

                                {/* ── PAYMENT_OPEN ── */}
                                {biddingRound.status === 'PAYMENT_OPEN' && (
                                    <>
                                        <p><strong>Winner:</strong>              {biddingRound.winnerName}</p>
                                        <p><strong>Winning Bid:</strong>         {formatCurrency(biddingRound.winningBidAmount)}</p>
                                        <p><strong>Payable per Member:</strong>  {formatCurrency(biddingRound.payablePerMember)}</p>
                                        <p><strong>Winner Receivable:</strong>   {formatCurrency(biddingRound.winnerReceivableAmount)}</p>
                                        <p><strong>Dividend per Member:</strong> {formatCurrency(biddingRound.dividendPerMember)}</p>

                                        <button
                                            className="action-btn finalize"
                                            onClick={handleFinalizeBidding}
                                        >
                                            Finalize Bidding
                                        </button>
                                    </>
                                )}

                                {/* ── CLOSED with no winner (tie pending or no bids) ── */}
                                {biddingRound.status === 'CLOSED' && !biddingRound.winnerUserId && (
                                    <>
                                        <p>No bids were placed. Bidding closed.</p>
                                        <button className="action-btn reopen" onClick={handleOpenBidding}>
                                            Open Bidding Again
                                        </button>
                                    </>
                                )}

                                {/* ── FINALIZED ── */}
                                {biddingRound.status === 'FINALIZED' && (
                                    <p>Bidding finalized. Group moved to next month.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-bidding">
                            <p>No active bidding round for current month.</p>
                            <button className="action-btn open" onClick={handleOpenBidding}>
                                Open Bidding
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Members Table ── */}
            <div className="members-section">
                <h2 className="section-title">Members</h2>
                <div className="members-table-container">
                    <table className="members-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Total Paid</th>
                                <th>Expected Till Now</th>
                                <th>Pending</th>
                                <th>Current Month Paid</th>
                                <th>Has Won</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member) => (
                                <tr key={member.userId}>
                                    <td className="member-name">{member.name}</td>
                                    <td>{member.phone || '—'}</td>
                                    <td>{formatCurrency(member.totalPaid)}</td>
                                    <td>{formatCurrency(member.expectedTillNow)}</td>
                                    <td className={member.pendingAmount > 0 ? 'pending' : 'paid'}>
                                        {formatCurrency(member.pendingAmount)}
                                    </td>
                                    <td>{formatCurrency(member.currentMonthPaid)}</td>
                                    <td>
                                        {member.hasWon
                                            ? <span className="won-badge">✓ Won</span>
                                            : <span className="not-won-badge">—</span>}
                                    </td>
                                    <td>
                                        <button
                                            className="history-btn"
                                            onClick={() => openHistoryModal(member)}
                                        >
                                            History
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── History Modal ── */}
            {showHistoryModal && selectedMember && (
                <div className="modal-overlay" onClick={closeHistoryModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Contribution History – {selectedMember.name}</h3>
                            <button className="modal-close" onClick={closeHistoryModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {selectedMember.contributionHistory.length === 0 ? (
                                <p className="no-history">No contributions recorded yet.</p>
                            ) : (
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Month</th><th>Amount</th><th>Mode</th>
                                            <th>Collected By</th><th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedMember.contributionHistory.map((entry, idx) => (
                                            <tr key={idx}>
                                                <td>Month {entry.monthNumber}</td>
                                                <td>{formatCurrency(entry.amountPaid)}</td>
                                                <td>{entry.paymentMode}</td>
                                                <td>{entry.collectorName || '—'}</td>
                                                <td>{formatDate(entry.collectedAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Member Modal ── */}
            {showAddMemberModal && (
                <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add Member to {group.name}</h3>
                            <button className="modal-close" onClick={() => setShowAddMemberModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="search-wrapper">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search by name or phone..."
                                    value={userSearchTerm}
                                    onChange={e => setUserSearchTerm(e.target.value)}
                                />
                            </div>
                            {loadingUsers ? (
                                <div className="loading-users">
                                    <div className="spinner-small"></div>
                                    <p>Loading users...</p>
                                </div>
                            ) : (
                                <div className="user-list">
                                    {filteredUsers.length === 0 ? (
                                        <p className="no-users">No eligible approved users found.</p>
                                    ) : (
                                        filteredUsers.map(user => (
                                            <div key={user._id} className="user-item">
                                                <div className="user-info">
                                                    <span className="user-name">{user.name}</span>
                                                    <span className="user-phone">{user.phoneNumber}</span>
                                                </div>
                                                <button
                                                    className="add-user-btn"
                                                    onClick={() => handleAddMember(user._id)}
                                                    disabled={addingUserId === user._id}
                                                >
                                                    {addingUserId === user._id
                                                        ? <span className="spinner-small"></span>
                                                        : 'Add'}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tie Resolution Modal ── */}
            {tieModalOpen && (
                <div className="modal-overlay" onClick={() => setTieModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Resolve Tie – Select Winner</h3>
                            <button className="modal-close" onClick={() => setTieModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Multiple users placed the highest bid. Please select the winner:</p>
                            <div className="tie-user-list">
                                {tiedUsers.map(user => (
                                    <label key={user.userId} className="tie-user-item">
                                        <input
                                            type="radio"
                                            name="winner"
                                            value={user.userId}
                                            onChange={() => setSelectedWinner(user.userId)}
                                        />
                                        <span>{user.name} – Bid: {formatCurrency(user.bidAmount)}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="modal-actions">
                                <button className="cancel-btn" onClick={() => setTieModalOpen(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="submit-btn"
                                    onClick={handleResolveTie}
                                    disabled={!selectedWinner || resolvingTie}
                                >
                                    {resolvingTie
                                        ? <Loader size={16} className="spinner" />
                                        : 'Confirm Winner'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDetails;