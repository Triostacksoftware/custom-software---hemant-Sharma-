import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/userApi';
import { io } from 'socket.io-client';
import {
    ArrowLeft,
    Users,
    Calendar,
    IndianRupee,
    Award,
    Clock,
    Loader,
    AlertCircle,
    CheckCircle,
    Send,
    ChevronDown
} from 'lucide-react';
import './GroupDetails.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// Payment mode options mirror the Transaction schema enum exactly
const PAYMENT_MODES = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'INTERNET_BANKING', label: 'Internet Banking' },
    { value: 'CHEQUE', label: 'Cheque' },
];

const GroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ── Bidding state ─────────────────────────────────────────────────────────
    const [biddingRound, setBiddingRound] = useState(null);
    const [bids, setBids] = useState([]);
    const [bidAmount, setBidAmount] = useState('');
    const [placingBid, setPlacingBid] = useState(false);
    const [bidError, setBidError] = useState('');
    const [bidSuccess, setBidSuccess] = useState('');
    const [socket, setSocket] = useState(null);

    // Anonymous name mapping for live bidding feed
    const [anonMap, setAnonMap] = useState({});
    const nextAnonId = useRef(1);

    // ── Transaction confirmation state ────────────────────────────────────────
    const [confirming, setConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [confirmSuccess, setConfirmSuccess] = useState('');
    const [confirmAmount, setConfirmAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');

    // ── Employee list state ───────────────────────────────────────────────────
    const [employees, setEmployees] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);

    // localStorage key for bid caching per round
    const getStorageKey = (roundId) => `bids_${groupId}_${roundId}`;

    useEffect(() => {
        fetchGroupDetails();
        return () => {
            if (socket) socket.disconnect();
        };
    }, [groupId]);

    useEffect(() => {
        if (biddingRound?.status === 'PAYMENT_OPEN' && employees.length === 0) {
            fetchEmployees();
        }
    }, [biddingRound?.status]);

    useEffect(() => {
        if (biddingRound && biddingRound.status === 'OPEN') {
            const newSocket = io(SOCKET_URL);
            setSocket(newSocket);

            newSocket.on('connect', () => {
                newSocket.emit('joinBiddingRoom', { biddingRoundId: biddingRound._id });
            });

            newSocket.on('newBidPlaced', (bid) => {
                setBids(prev => {
                    const exists = prev.some(
                        b => b.userId === bid.userId && b.timestamp === bid.timestamp
                    );
                    if (exists) return prev;

                    if (!anonMap[bid.userId]) {
                        const newId = nextAnonId.current++;
                        setAnonMap(map => ({ ...map, [bid.userId]: `Member ${newId}` }));
                    }

                    const newBids = [...prev, bid];
                    localStorage.setItem(
                        getStorageKey(biddingRound._id),
                        JSON.stringify(newBids)
                    );
                    return newBids;
                });
            });

            newSocket.on('biddingClosed', (data) => {
                if (data.winnerUserId) {
                    setBiddingRound(prev => ({
                        ...prev,
                        status: 'PAYMENT_OPEN',
                        winnerUserId: data.winnerUserId,
                        winningBidAmount: data.winningBidAmount,
                        winnerReceivableAmount: data.winnerReceivableAmount,
                        dividendPerMember: data.dividendPerMember,
                        payablePerMember: data.payablePerMember,
                    }));
                } else {
                    setBiddingRound(prev => ({ ...prev, status: 'CLOSED' }));
                    setBidSuccess('Tie detected. Waiting for admin to select winner.');
                }

                fetchGroupDetails();
                localStorage.removeItem(getStorageKey(biddingRound._id));
            });

            return () => { newSocket.disconnect(); };
        }
    }, [biddingRound]);

    const fetchGroupDetails = async () => {
        try {
            setLoading(true);
            const response = await userApi.getGroupDetails(groupId);
            const data = response.data.data;
            setGroupData(data);

            const round = data.currentBiddingRound;
            setBiddingRound(round);

            if (data.bids && data.bids.length > 0) {
                setBids(data.bids);
                if (round) {
                    localStorage.setItem(
                        getStorageKey(round._id),
                        JSON.stringify(data.bids)
                    );
                }
                const map = {};
                let nextId = 1;
                data.bids.forEach(bid => {
                    if (!map[bid.userId]) map[bid.userId] = `Member ${nextId++}`;
                });
                setAnonMap(map);
                nextAnonId.current = nextId;
            } else if (round) {
                const stored = localStorage.getItem(getStorageKey(round._id));
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        setBids(parsed);
                        const map = {};
                        let nextId = 1;
                        parsed.forEach(bid => {
                            if (!map[bid.userId]) map[bid.userId] = `Member ${nextId++}`;
                        });
                        setAnonMap(map);
                        nextAnonId.current = nextId;
                    } catch (e) {
                        console.error('Failed to parse stored bids', e);
                        setBids([]);
                        setAnonMap({});
                        nextAnonId.current = 1;
                    }
                } else {
                    setBids([]);
                    setAnonMap({});
                    nextAnonId.current = 1;
                }
            } else {
                setBids([]);
                setAnonMap({});
                nextAnonId.current = 1;
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load group details');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            setEmployeesLoading(true);
            const response = await userApi.getEmployees();
            setEmployees(response.data.data.employees || []);
        } catch (err) {
            console.error('Failed to fetch employees', err);
        } finally {
            setEmployeesLoading(false);
        }
    };

    const handlePlaceBid = async (e) => {
        e.preventDefault();
        if (!biddingRound || biddingRound.status !== 'OPEN') return;
        setPlacingBid(true);
        setBidError('');
        setBidSuccess('');
        try {
            await userApi.placeBid({
                biddingRoundId: biddingRound._id,
                bidAmount: Number(bidAmount)
            });
            setBidAmount('');
        } catch (err) {
            setBidError(err.response?.data?.message || 'Failed to place bid');
        } finally {
            setPlacingBid(false);
        }
    };

    const handleConfirmTransaction = async (isCurrentRoundWinner) => {
        if (!biddingRound || biddingRound.status !== 'PAYMENT_OPEN') return;

        const type = isCurrentRoundWinner ? 'WINNER_PAYOUT' : 'CONTRIBUTION';
        const amount = Number(confirmAmount);
        const maxAllowed = isCurrentRoundWinner ? remainingPayout : remainingContribution;

        if (!amount || amount <= 0 || amount > maxAllowed) {
            setConfirmError(`Amount must be between ₹1 and ${formatCurrency(maxAllowed)}`);
            return;
        }
        if (!paymentMode) {
            setConfirmError('Please select a payment mode.');
            return;
        }
        if (!selectedEmployee) {
            setConfirmError('Please select the employee handling this transaction.');
            return;
        }

        const confirmMessage = isCurrentRoundWinner
            ? `Confirm receiving ${formatCurrency(amount)} via ${paymentMode}?`
            : `Confirm paying ${formatCurrency(amount)} via ${paymentMode}?`;
        if (!window.confirm(confirmMessage)) return;

        setConfirming(true);
        setConfirmError('');
        setConfirmSuccess('');

        try {
            await userApi.confirmTransaction({
                groupId,
                biddingRoundId: biddingRound._id,
                monthNumber: biddingRound.monthNumber,
                amount,
                type,
                paymentMode,
                handledBy: selectedEmployee
            });

            setConfirmAmount('');
            setPaymentMode('');
            setSelectedEmployee('');
            setConfirmSuccess(
                `${formatCurrency(amount)} confirmation submitted! Awaiting employee verification.`
            );

            fetchGroupDetails();
        } catch (err) {
            setConfirmError(
                err.response?.data?.message || 'Failed to confirm transaction'
            );
        } finally {
            setConfirming(false);
        }
    };

    const formatCurrency = (amount) => {
        if (amount == null || amount === '') return '₹0';
        const num = Number(amount);
        if (isNaN(num)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(num);
    };

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="loading-container">
                <Loader size={40} className="spinner" />
                <p>Loading group details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <AlertCircle size={40} />
                <p>{error}</p>
                <button onClick={fetchGroupDetails}>Retry</button>
            </div>
        );
    }

    if (!groupData) return null;

    const { group, memberInfo, transactions, biddingHistory } = groupData;

    // ── FIX: Two separate winner flags ────────────────────────────────────────
    //
    // Previously a single `isWinner = memberInfo?.hasWon` was used everywhere.
    // `memberInfo.hasWon` is set by the backend whenever the user has EVER won
    // in this group — it is a lifetime flag and remains true in all future months.
    //
    // Using that flag to gate the PAYMENT_OPEN contribution/payout sections
    // caused the bug: in month 2, the previous winner (hasWon=true) was shown
    // the PAYOUT section (with the current round's winnerReceivableAmount, e.g.
    // ₹24000) instead of the CONTRIBUTION section showing the ₹8000 they owe.
    //
    // Solution: split into two variables used in the right places:
    //
    //   hasEverWon          → lifetime flag. Correct for:
    //                           • "You Won!" info card
    //                           • blocking the member from placing new bids
    //
    //   isCurrentRoundWinner → true ONLY if this member won THIS month's round.
    //                           Correct for:
    //                           • showing contribution vs payout section
    //                           • calling handleConfirmTransaction(true/false)
    // ─────────────────────────────────────────────────────────────────────────
    const hasEverWon = memberInfo?.hasWon;
    const isCurrentRoundWinner =
        biddingRound?.winnerUserId?.toString() === user?._id?.toString();

    const totalPool = group.totalMembers * group.monthlyContribution;

    // ── Payment progress calculations ─────────────────────────────────────────
    const paidContribution = transactions
        .filter(tx =>
            tx.monthNumber === biddingRound?.monthNumber &&
            tx.type === 'CONTRIBUTION' &&
            ['USER_CONFIRMED', 'COMPLETED'].includes(tx.status)
        )
        .reduce((sum, tx) => sum + tx.amount, 0);

    const paidPayout = transactions
        .filter(tx =>
            tx.monthNumber === biddingRound?.monthNumber &&
            tx.type === 'WINNER_PAYOUT' &&
            ['USER_CONFIRMED', 'COMPLETED'].includes(tx.status)
        )
        .reduce((sum, tx) => sum + tx.amount, 0);

    const remainingContribution =
        (biddingRound?.payablePerMember || 0) - paidContribution;

    const remainingPayout =
        (biddingRound?.winnerReceivableAmount || 0) - paidPayout;

    // ── Shared partial payment form ───────────────────────────────────────────
    const renderConfirmForm = (isWinnerForm, remaining) => (
        <div className="partial-confirm-form">

            <div className="confirm-field">
                <label className="confirm-label">Amount</label>
                <input
                    type="number"
                    value={confirmAmount}
                    onChange={e => setConfirmAmount(e.target.value)}
                    placeholder={`Max ${formatCurrency(remaining)}`}
                    min={1}
                    max={remaining}
                    disabled={confirming}
                    className="confirm-input"
                />
            </div>

            <div className="confirm-field">
                <label className="confirm-label">Payment Mode</label>
                <div className="select-wrapper">
                    <select
                        value={paymentMode}
                        onChange={e => setPaymentMode(e.target.value)}
                        disabled={confirming}
                        className="confirm-select"
                    >
                        <option value="">Select mode</option>
                        {PAYMENT_MODES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="select-icon" />
                </div>
            </div>

            <div className="confirm-field">
                <label className="confirm-label">Employee</label>
                <div className="select-wrapper">
                    {employeesLoading ? (
                        <div className="select-loading">
                            <Loader size={14} className="spinner" /> Loading employees…
                        </div>
                    ) : (
                        <>
                            <select
                                value={selectedEmployee}
                                onChange={e => setSelectedEmployee(e.target.value)}
                                disabled={confirming}
                                className="confirm-select"
                            >
                                <option value="">Select employee</option>
                                {employees.map(emp => (
                                    <option key={emp._id} value={emp._id}>
                                        {emp.name}{emp.phoneNumber ? ` · ${emp.phoneNumber}` : ''}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </>
                    )}
                </div>
            </div>

            <button
                className="confirm-btn"
                onClick={() => handleConfirmTransaction(isWinnerForm)}
                disabled={confirming || !confirmAmount || !paymentMode || !selectedEmployee}
            >
                {confirming
                    ? <Loader size={16} className="spinner" />
                    : isWinnerForm ? 'Confirm Receipt' : 'Confirm Payment'}
            </button>
        </div>
    );

    return (
        <div className="group-details-page">
            <button className="back-btn" onClick={() => navigate('/user/dashboard')}>
                <ArrowLeft size={18} /> Back
            </button>
            <h1 className="page-title">{group.name}</h1>

            {/* ── Group Info Cards ── */}
            <div className="info-cards">
                <div className="info-card">
                    <Users size={20} />
                    <div>
                        <span className="info-label">Total Members</span>
                        <span className="info-value">{group.totalMembers}</span>
                    </div>
                </div>
                <div className="info-card">
                    <Calendar size={20} />
                    <div>
                        <span className="info-label">Duration</span>
                        <span className="info-value">{group.totalMonths} months</span>
                    </div>
                </div>
                <div className="info-card">
                    <IndianRupee size={20} />
                    <div>
                        <span className="info-label">Monthly Contribution</span>
                        <span className="info-value">{formatCurrency(group.monthlyContribution)}</span>
                    </div>
                </div>
                <div className="info-card">
                    <Clock size={20} />
                    <div>
                        <span className="info-label">Current Month</span>
                        <span className="info-value">{group.currentMonth}/{group.totalMonths}</span>
                    </div>
                </div>
                <div className="info-card">
                    <IndianRupee size={20} />
                    <div>
                        <span className="info-label">Total Pool</span>
                        <span className="info-value">{formatCurrency(totalPool)}</span>
                    </div>
                </div>

                {/* Uses hasEverWon — correct, this card is a permanent record */}
                {hasEverWon && (
                    <div className="info-card winner">
                        <Award size={20} />
                        <div>
                            <span className="info-label">You Won!</span>
                            <span className="info-value">{formatCurrency(memberInfo.winningAmount)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bidding Section ── */}
            {biddingRound && (
                <div className="bidding-section">
                    <h2 className="section-title">Bidding – Month {biddingRound.monthNumber}</h2>
                    <div className="bidding-status">
                        <span className={`status-badge ${biddingRound.status.toLowerCase()}`}>
                            {biddingRound.status}
                        </span>
                        {biddingRound.status === 'OPEN' && (
                            <span>Ends at {formatDate(biddingRound.endedAt)}</span>
                        )}
                    </div>

                    {/* ── OPEN: live bidding feed ── */}
                    {biddingRound.status === 'OPEN' && (
                        <div className="live-bidding">
                            <div className="bid-feed">
                                {bids.length === 0 ? (
                                    <p className="no-bids">No bids yet. Be the first to bid!</p>
                                ) : (
                                    bids.map((bid, idx) => {
                                        const isOwnBid =
                                            bid.userId?.toString() === user?._id?.toString();
                                        return (
                                            <div
                                                key={idx}
                                                className={`bid-message ${isOwnBid ? 'own-bid' : ''}`}
                                            >
                                                <span className="bidder">
                                                    {isOwnBid ? 'You' : anonMap[bid.userId] || 'Member'}
                                                </span>
                                                <span className="bid-amount">
                                                    {formatCurrency(bid.bidAmount)}
                                                </span>
                                                <span className="bid-time">
                                                    {formatDate(bid.timestamp)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Uses hasEverWon — correct, prevents re-bidding forever */}
                            {!hasEverWon ? (
                                <form onSubmit={handlePlaceBid} className="bid-form">
                                    <div className="input-group">
                                        <input
                                            type="number"
                                            value={bidAmount}
                                            onChange={e => setBidAmount(e.target.value)}
                                            placeholder={`Min ${formatCurrency(biddingRound.minBid)} - Max ${formatCurrency(biddingRound.maxBid)}`}
                                            min={biddingRound.minBid}
                                            max={biddingRound.maxBid}
                                            required
                                            disabled={placingBid}
                                        />
                                        <button type="submit" disabled={placingBid}>
                                            {placingBid
                                                ? <Loader size={16} className="spinner" />
                                                : <Send size={16} />}
                                        </button>
                                    </div>
                                    <small>
                                        Bid must be between {formatCurrency(biddingRound.minBid)} and {formatCurrency(biddingRound.maxBid)}
                                    </small>
                                </form>
                            ) : (
                                <p className="info-message">
                                    You have already won in this group and cannot bid again.
                                </p>
                            )}

                            {bidError && (
                                <div className="error-message">
                                    <AlertCircle size={16} /> {bidError}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── PAYMENT_OPEN ── */}
                    {biddingRound.status === 'PAYMENT_OPEN' && (
                        <div className="payment-info">

                            {isCurrentRoundWinner ? (
                                <div className="winner-banner">
                                    <Award size={22} />
                                    <span>
                                        You won the bidding! You will receive{' '}
                                        {formatCurrency(biddingRound.winnerReceivableAmount)}
                                    </span>
                                </div>
                            ) : (
                                <div className="non-winner-banner">
                                    <span>Bidding closed. Payments are now open.</span>
                                </div>
                            )}

                            <div className="payment-summary">
                                <p><strong>Winning Bid:</strong> {formatCurrency(biddingRound.winningBidAmount)}</p>
                                <p><strong>Payable per Member:</strong> {formatCurrency(biddingRound.payablePerMember)}</p>
                                <p><strong>Winner Receivable:</strong> {formatCurrency(biddingRound.winnerReceivableAmount)}</p>
                                <p><strong>Dividend per Member:</strong> {formatCurrency(biddingRound.dividendPerMember)}</p>
                            </div>

                            {/*
                             * FIX: was `!isWinner` — showed nothing for previous winners.
                             * Now uses isCurrentRoundWinner so a member who won in a
                             * prior month correctly sees their contribution form here.
                             */}
                            {!isCurrentRoundWinner && (
                                <div className="partial-payment-section">
                                    <h3 className="partial-payment-title">Your Contribution</h3>
                                    <div className="payment-progress">
                                        <div className="progress-labels">
                                            <span>Amount Confirmed</span>
                                            <span>
                                                {formatCurrency(paidContribution)} /{' '}
                                                {formatCurrency(biddingRound.payablePerMember)}
                                            </span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${Math.min(
                                                        (paidContribution / biddingRound.payablePerMember) * 100,
                                                        100
                                                    )}%`
                                                }}
                                            />
                                        </div>
                                        <span className="remaining-label">
                                            Remaining: {formatCurrency(remainingContribution)}
                                        </span>
                                    </div>

                                    {remainingContribution > 0
                                        ? renderConfirmForm(false, remainingContribution)
                                        : (
                                            <div className="success-message">
                                                <CheckCircle size={16} />
                                                Full contribution confirmed. Awaiting employee verification.
                                            </div>
                                        )
                                    }
                                </div>
                            )}

                            {/*
                             * FIX: was `isWinner` — wrongly shown to previous-month winners.
                             * Now uses isCurrentRoundWinner so only this month's winner
                             * sees the payout section with the correct receivable amount.
                             */}
                            {isCurrentRoundWinner && (
                                <div className="partial-payment-section">
                                    <h3 className="partial-payment-title">Your Payout</h3>
                                    <div className="payment-progress">
                                        <div className="progress-labels">
                                            <span>Amount Received</span>
                                            <span>
                                                {formatCurrency(paidPayout)} /{' '}
                                                {formatCurrency(biddingRound.winnerReceivableAmount)}
                                            </span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill winner-progress"
                                                style={{
                                                    width: `${Math.min(
                                                        (paidPayout / biddingRound.winnerReceivableAmount) * 100,
                                                        100
                                                    )}%`
                                                }}
                                            />
                                        </div>
                                        <span className="remaining-label">
                                            Remaining: {formatCurrency(remainingPayout)}
                                        </span>
                                    </div>

                                    {remainingPayout > 0
                                        ? renderConfirmForm(true, remainingPayout)
                                        : (
                                            <div className="success-message">
                                                <CheckCircle size={16} />
                                                Full payout received and confirmed. Awaiting employee verification.
                                            </div>
                                        )
                                    }
                                </div>
                            )}

                            {confirmError && (
                                <div className="error-message">
                                    <AlertCircle size={16} /> {confirmError}
                                </div>
                            )}
                            {confirmSuccess && (
                                <div className="success-message">
                                    <CheckCircle size={16} /> {confirmSuccess}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CLOSED with tie */}
                    {biddingRound.status === 'CLOSED' && !biddingRound.winnerUserId && (
                        <p className="info-message">
                            Bidding closed. Waiting for admin to resolve the tie.
                        </p>
                    )}

                    {/* CLOSED with no bids */}
                    {biddingRound.status === 'CLOSED' && bids.length === 0 && (
                        <p className="info-message">No bids were placed. Bidding closed.</p>
                    )}

                    {/* FINALIZED */}
                    {biddingRound.status === 'FINALIZED' && (
                        <p className="info-message">Bidding finalized. Group moved to next month.</p>
                    )}
                </div>
            )}

            {/* ── Transaction History ── */}
            <div className="history-section">
                <h2 className="section-title">Transaction History</h2>
                {transactions.length === 0 ? (
                    <p className="no-data">No transactions yet.</p>
                ) : (
                    <table className="transactions-table">
                        <thead>
                            <tr>
                                <th>Date</th><th>Type</th><th>Month</th>
                                <th>Amount</th><th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => (
                                <tr key={tx._id}>
                                    <td>{formatDate(tx.createdAt)}</td>
                                    <td>{tx.type === 'CONTRIBUTION' ? 'Contribution' : 'Payout'}</td>
                                    <td>{tx.monthNumber}</td>
                                    <td>{formatCurrency(tx.amount)}</td>
                                    <td>
                                        <span className={`status-badge ${tx.status.toLowerCase()}`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Bidding History ── */}
            <div className="history-section">
                <h2 className="section-title">Bidding History</h2>
                {biddingHistory.length === 0 ? (
                    <p className="no-data">No bidding history.</p>
                ) : (
                    <table className="bidding-table">
                        <thead>
                            <tr>
                                <th>Month</th><th>Your Bid</th>
                                <th>Winning Bid</th><th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {biddingHistory.map((round, idx) => (
                                <tr key={idx}>
                                    <td>Month {round.monthNumber}</td>
                                    <td>{round.userBid ? formatCurrency(round.userBid) : '—'}</td>
                                    <td>{round.winningBid ? formatCurrency(round.winningBid) : '—'}</td>
                                    <td>
                                        {round.winnerUserId?.toString() === user?._id?.toString() ? (
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