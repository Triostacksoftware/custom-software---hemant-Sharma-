import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { employeeApi } from '../../api/employeeApi';
import {
    Calendar, IndianRupee, User, Users, FileText,
    CheckCircle, AlertCircle, Loader, Info, Award, Clock
} from 'lucide-react';
import './LogContribution.css';

const LogContribution = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const preselectedGroupId = location.state?.groupId;

    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [pendingData, setPendingData] = useState(null);

    // selectedMember holds the full member object from pendingData
    const [selectedMember, setSelectedMember] = useState(null);

    // selectedConfirmation is one of the member's USER_CONFIRMED transactions.
    // When set, amount is locked to this confirmation's amount — the employee
    // is verifying exactly what the member declared.
    const [selectedConfirmation, setSelectedConfirmation] = useState(null);

    const [amount, setAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [remarks, setRemarks] = useState('');
    const [collectedAt, setCollectedAt] = useState(() =>
        new Date().toISOString().split('T')[0]
    );

    // UI states
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingPending, setLoadingPending] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [validationErrors, setValidationErrors] = useState({});

    const paymentModes = ['CASH', 'UPI', 'INTERNET_BANKING', 'CHEQUE'];

    // Fetch active groups on mount
    useEffect(() => {
        fetchGroups();
    }, []);

    // Auto-select group if navigated from dashboard with a groupId
    useEffect(() => {
        if (groups.length > 0 && preselectedGroupId) {
            const exists = groups.some(g => g._id === preselectedGroupId);
            if (exists) setSelectedGroupId(preselectedGroupId);
        }
    }, [groups, preselectedGroupId]);

    const fetchGroups = async () => {
        setLoadingGroups(true);
        setError('');
        try {
            const response = await employeeApi.getActiveGroups();
            setGroups(response.data.groups || []);
        } catch (err) {
            setError('Failed to load groups. Please try again.');
        } finally {
            setLoadingGroups(false);
        }
    };

    // Fetch pending transactions whenever the selected group changes
    useEffect(() => {
        if (!selectedGroupId) {
            setPendingData(null);
            resetSelection();
            return;
        }
        fetchPending();
    }, [selectedGroupId]);

    const fetchPending = async () => {
        setLoadingPending(true);
        setError('');
        try {
            const response = await employeeApi.getPendingTransactions(selectedGroupId);
            setPendingData(response.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load pending transactions.');
        } finally {
            setLoadingPending(false);
        }
    };

    const resetSelection = () => {
        setSelectedMember(null);
        setSelectedConfirmation(null);
        setAmount('');
        setPaymentMode('');
    };

    // When a member is selected, clear any previously selected confirmation
    const handleSelectMember = (member) => {
        setSelectedMember(member);
        setSelectedConfirmation(null);
        setAmount('');
        setValidationErrors({});
    };

    // When the employee clicks a specific USER_CONFIRMED installment to verify:
    // lock the amount to exactly what the member declared — the backend finds
    // the USER_CONFIRMED record by exact amount match.
    const handleSelectConfirmation = (member, confirmation) => {
        setSelectedMember(member);
        setSelectedConfirmation(confirmation);
        setAmount(confirmation.amount.toString());
        // Pre-fill payment mode from member's confirmation if available
        if (confirmation.paymentMode) setPaymentMode(confirmation.paymentMode);
        setValidationErrors({});
    };

    const validateForm = () => {
        const errors = {};

        if (!selectedGroupId) errors.groupId = 'Please select a group';
        if (!selectedMember) errors.member = 'Please select a member or confirmation';

        if (!amount) {
            errors.amount = 'Amount is required';
        } else if (isNaN(amount) || Number(amount) <= 0) {
            errors.amount = 'Amount must be a positive number';
        } else if (
            // Only cap at remainingAmount when verifying a new (non-confirmed) amount.
            // When verifying a USER_CONFIRMED installment the amount is locked and
            // may legitimately equal more than the current "remaining" (since remaining
            // is calculated from COMPLETED only, and this confirmation is still USER_CONFIRMED).
            !selectedConfirmation &&
            selectedMember &&
            Number(amount) > selectedMember.remainingAmount
        ) {
            errors.amount = `Amount cannot exceed remaining ₹${selectedMember.remainingAmount}`;
        }

        if (!paymentMode) errors.paymentMode = 'Please select payment mode';

        if (collectedAt && new Date(collectedAt) > new Date()) {
            errors.collectedAt = 'Collection date cannot be in the future';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setSubmitting(true);
        setError('');
        setSuccess('');

        const payload = {
            groupId: selectedGroupId,
            userId: selectedMember.userId,
            monthNumber: pendingData?.currentMonth,
            amount: Number(amount),
            paymentMode,
            remarks: remarks.trim() || undefined,
            handledAt: collectedAt || undefined,
            type: selectedMember.type,
        };

        try {
            await employeeApi.logTransaction(payload);
            setSuccess('Transaction logged successfully!');
            // Refresh pending data to reflect the newly COMPLETED transaction
            await fetchPending();
            resetSelection();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to log transaction.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (val) =>
        `₹${Number(val || 0).toLocaleString('en-IN')}`;

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Renders the pending confirmations list for a given member.
    // Each confirmation is a USER_CONFIRMED installment the member has declared
    // but the employee hasn't verified yet.
    const renderPendingConfirmations = (member) => {
        if (!member.pendingConfirmations?.length) return null;

        return (
            <div className="confirmation-list">
                <p className="confirmation-label">
                    <Clock size={13} /> Member-confirmed installments awaiting your verification:
                </p>
                {member.pendingConfirmations.map((conf) => (
                    <button
                        key={conf.transactionId}
                        type="button"
                        className={`confirmation-item ${selectedConfirmation?.transactionId === conf.transactionId
                            ? 'selected'
                            : ''
                            }`}
                        onClick={() => handleSelectConfirmation(member, conf)}
                    >
                        <span className="conf-amount">{formatCurrency(conf.amount)}</span>
                        <span className="conf-mode">{conf.paymentMode}</span>
                        <span className="conf-date">{formatDate(conf.createdAt)}</span>
                        <span className="conf-action">Verify →</span>
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="log-contribution-page">
            <h1 className="page-title">Log Payment</h1>
            <p className="page-subtitle">Record member contributions or winner payout</p>

            {error && (
                <div className="error-message">
                    <AlertCircle size={18} /><span>{error}</span>
                </div>
            )}
            {success && (
                <div className="success-message">
                    <CheckCircle size={18} /><span>{success}</span>
                </div>
            )}

            <form className="contribution-form" onSubmit={handleSubmit}>

                {/* ── Group Selection ── */}
                <div className="form-group">
                    <label>Select Group *</label>
                    <div className="select-wrapper">
                        <Users size={18} className="input-icon" />
                        <select
                            value={selectedGroupId}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            disabled={loadingGroups || submitting}
                            className={validationErrors.groupId ? 'error' : ''}
                        >
                            <option value="">-- Choose a group --</option>
                            {groups.map(g => (
                                <option key={g._id} value={g._id}>
                                    {g.name} (Month {g.currentMonth})
                                </option>
                            ))}
                        </select>
                    </div>
                    {validationErrors.groupId && (
                        <span className="field-error">{validationErrors.groupId}</span>
                    )}
                    {loadingGroups && (
                        <div className="inline-loader">
                            <Loader size={16} className="spinner" /> Loading groups...
                        </div>
                    )}
                </div>

                {/* ── Group Info Summary ── */}
                {pendingData && (
                    <div className="info-box">
                        <div className="info-header">
                            <Info size={16} /> {pendingData.groupName}
                        </div>
                        <div className="info-details">
                            <p><strong>Current Month:</strong> {pendingData.currentMonth}</p>
                            <p><strong>Payable per Member:</strong> {formatCurrency(pendingData.payablePerMember)}</p>
                            <p><strong>Pending Contributions:</strong> {pendingData.contributionPendingCount}</p>
                            {pendingData.payoutPending && (
                                <p>
                                    <strong>Winner Payout Remaining:</strong>{' '}
                                    {formatCurrency(pendingData.payoutPending.remainingAmount)}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {loadingPending && (
                    <div className="inline-loader">
                        <Loader size={16} className="spinner" /> Loading pending transactions...
                    </div>
                )}

                {/* ── Members with Pending Contributions ── */}
                {pendingData?.contributionPendingMembers?.length > 0 && (
                    <div className="form-group">
                        <label>Members with Pending Contribution</label>
                        <div className="member-list">
                            {pendingData.contributionPendingMembers.map(m => (
                                <div key={m.userId} className="member-block">
                                    {/* Member row — click to select, shows remaining balance */}
                                    <button
                                        type="button"
                                        className={`member-item ${selectedMember?.userId === m.userId ? 'selected' : ''}`}
                                        onClick={() => handleSelectMember({ ...m, type: 'CONTRIBUTION' })}
                                    >
                                        <User size={16} />
                                        <span className="member-name">{m.name}</span>
                                        {m.phoneNumber && (
                                            <span className="member-phone">{m.phoneNumber}</span>
                                        )}
                                        <span className="member-remaining">
                                            Remaining: {formatCurrency(m.remainingAmount)}
                                        </span>
                                    </button>

                                    {/* USER_CONFIRMED installments waiting for employee to verify */}
                                    {renderPendingConfirmations({ ...m, type: 'CONTRIBUTION' })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Winner Payout Pending ── */}
                {pendingData?.payoutPending && (
                    <div className="form-group">
                        <label>Winner Payout Pending</label>
                        <div className="member-block">
                            <button
                                type="button"
                                className={`member-item winner-item ${selectedMember?.userId === pendingData.payoutPending.userId &&
                                    !selectedConfirmation
                                    ? 'selected'
                                    : ''
                                    }`}
                                onClick={() =>
                                    handleSelectMember({
                                        ...pendingData.payoutPending,
                                        type: 'WINNER_PAYOUT'
                                    })
                                }
                            >
                                <Award size={16} />
                                <span className="member-name">
                                    {pendingData.payoutPending.name}
                                </span>
                                <span className="member-remaining">
                                    Remaining: {formatCurrency(pendingData.payoutPending.remainingAmount)}
                                </span>
                            </button>

                            {renderPendingConfirmations({
                                ...pendingData.payoutPending,
                                type: 'WINNER_PAYOUT'
                            })}
                        </div>
                    </div>
                )}

                {validationErrors.member && (
                    <span className="field-error">{validationErrors.member}</span>
                )}

                {/* ── Amount ── */}
                <div className="form-group">
                    <label>Amount (₹) *</label>
                    <div className="input-wrapper">
                        <IndianRupee size={18} className="input-icon" />
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            min="1"
                            step="1"
                            // Lock the field when verifying a specific USER_CONFIRMED installment
                            // to prevent accidental edits — the backend matches by exact amount
                            readOnly={!!selectedConfirmation}
                            disabled={!selectedMember || submitting}
                            className={`${validationErrors.amount ? 'error' : ''} ${selectedConfirmation ? 'locked' : ''}`}
                        />
                    </div>
                    {validationErrors.amount && (
                        <span className="field-error">{validationErrors.amount}</span>
                    )}
                    {/* Contextual hint based on what the employee has selected */}
                    {selectedConfirmation && (
                        <small className="remaining-hint confirmation-hint">
                            <CheckCircle size={12} />
                            Verifying member-confirmed installment of{' '}
                            {formatCurrency(selectedConfirmation.amount)}
                        </small>
                    )}
                    {!selectedConfirmation && selectedMember && (
                        <small className="remaining-hint">
                            Remaining (verified): {formatCurrency(selectedMember.remainingAmount)}
                        </small>
                    )}
                </div>

                {/* ── Payment Mode ── */}
                <div className="form-group">
                    <label>Payment Mode *</label>
                    <div className="select-wrapper">
                        <FileText size={18} className="input-icon" />
                        <select
                            value={paymentMode}
                            onChange={e => setPaymentMode(e.target.value)}
                            disabled={submitting}
                            className={validationErrors.paymentMode ? 'error' : ''}
                        >
                            <option value="">-- Select mode --</option>
                            {paymentModes.map(mode => (
                                <option key={mode} value={mode}>{mode}</option>
                            ))}
                        </select>
                    </div>
                    {validationErrors.paymentMode && (
                        <span className="field-error">{validationErrors.paymentMode}</span>
                    )}
                </div>

                {/* ── Collection Date ── */}
                <div className="form-group">
                    <label>Collection Date (optional)</label>
                    <div className="input-wrapper">
                        <Calendar size={18} className="input-icon" />
                        <input
                            type="date"
                            value={collectedAt}
                            onChange={e => setCollectedAt(e.target.value)}
                            disabled={submitting}
                            max={new Date().toISOString().split('T')[0]}
                            className={validationErrors.collectedAt ? 'error' : ''}
                        />
                    </div>
                    {validationErrors.collectedAt && (
                        <span className="field-error">{validationErrors.collectedAt}</span>
                    )}
                </div>

                {/* ── Remarks ── */}
                <div className="form-group">
                    <label>Remarks (optional)</label>
                    <textarea
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Any additional notes"
                        rows="3"
                        disabled={submitting}
                    />
                </div>

                {/* ── Submit ── */}
                <div className="form-actions">
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => navigate('/employee/dashboard')}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={submitting}
                    >
                        {submitting
                            ? <><Loader size={18} className="spinner" /> Logging...</>
                            : 'Log Payment'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LogContribution;