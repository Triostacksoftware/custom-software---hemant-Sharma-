import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { employeeApi } from '../../api/employeeApi';
import {
    Calendar, IndianRupee, User, Users, FileText,
    CheckCircle, AlertCircle, Loader, Info, Award
} from 'lucide-react';
import './LogContribution.css';

const LogContribution = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const preselectedGroupId = location.state?.groupId;

    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [pendingData, setPendingData] = useState(null); // from API
    const [selectedMember, setSelectedMember] = useState(null); // { userId, name, type, remaining, ... }
    const [amount, setAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [remarks, setRemarks] = useState('');
    const [collectedAt, setCollectedAt] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // UI states
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingPending, setLoadingPending] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [validationErrors, setValidationErrors] = useState({});

    // Fetch active groups
    useEffect(() => {
        fetchGroups();
    }, []);

    // Auto-select group if passed from dashboard
    useEffect(() => {
        if (groups.length > 0 && preselectedGroupId) {
            const groupExists = groups.some(g => g._id === preselectedGroupId);
            if (groupExists) setSelectedGroupId(preselectedGroupId);
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

    // Fetch pending transactions when group changes
    useEffect(() => {
        if (!selectedGroupId) {
            setPendingData(null);
            setSelectedMember(null);
            setAmount('');
            return;
        }

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
        fetchPending();
    }, [selectedGroupId]);

    // When member selected, prefill amount with remaining
    useEffect(() => {
        if (selectedMember) {
            setAmount(selectedMember.remainingAmount.toString());
        } else {
            setAmount('');
        }
    }, [selectedMember]);

    // Validate form
    const validateForm = () => {
        const errors = {};
        if (!selectedGroupId) errors.groupId = 'Please select a group';
        if (!selectedMember) errors.member = 'Please select a member';
        if (!amount) {
            errors.amount = 'Amount is required';
        } else if (isNaN(amount) || Number(amount) <= 0) {
            errors.amount = 'Amount must be a positive number';
        } else if (selectedMember && Number(amount) > selectedMember.remainingAmount) {
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
            type: selectedMember.type, // "CONTRIBUTION" or "WINNER_PAYOUT"
        };

        try {
            await employeeApi.logTransaction(payload);
            setSuccess('Transaction logged successfully!');
            // Refresh pending data
            const response = await employeeApi.getPendingTransactions(selectedGroupId);
            setPendingData(response.data);
            setSelectedMember(null); // clear selection
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to log transaction.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const paymentModes = ['CASH', 'UPI', 'INTERNET_BANKING', 'CHEQUE'];

    return (
        <div className="log-contribution-page">
            <h1 className="page-title">Log Payment</h1>
            <p className="page-subtitle">Record member contributions or winner payout</p>

            {error && (
                <div className="error-message"><AlertCircle size={18} /><span>{error}</span></div>
            )}
            {success && (
                <div className="success-message"><CheckCircle size={18} /><span>{success}</span></div>
            )}

            <form className="contribution-form" onSubmit={handleSubmit}>
                {/* Group Selection */}
                <div className="form-group">
                    <label>Select Group *</label>
                    <div className="select-wrapper">
                        <Users size={18} className="input-icon" />
                        <select
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
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
                    {validationErrors.groupId && <span className="field-error">{validationErrors.groupId}</span>}
                    {loadingGroups && <div className="inline-loader"><Loader size={16} className="spinner" /> Loading groups...</div>}
                </div>

                {/* Group Info & Pending Summary */}
                {pendingData && (
                    <div className="info-box">
                        <div className="info-header"><Info size={16} /> {pendingData.groupName}</div>
                        <div className="info-details">
                            <p><strong>Current Month:</strong> {pendingData.currentMonth}</p>
                            <p><strong>Payable per Member:</strong> ₹{pendingData.payablePerMember?.toLocaleString()}</p>
                            <p><strong>Pending Contributions:</strong> {pendingData.contributionPendingCount}</p>
                            {pendingData.payoutPending && (
                                <p><strong>Winner Payout Pending:</strong> ₹{pendingData.payoutPending.remainingAmount?.toLocaleString()}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Member Selection – Two separate lists for clarity */}
                {pendingData && (
                    <>
                        {/* Contribution pending members */}
                        {pendingData.contributionPendingMembers?.length > 0 && (
                            <div className="form-group">
                                <label>Members with Pending Contribution</label>
                                <div className="member-list">
                                    {pendingData.contributionPendingMembers.map(m => (
                                        <button
                                            key={m.userId}
                                            type="button"
                                            className={`member-item ${selectedMember?.userId === m.userId ? 'selected' : ''}`}
                                            onClick={() => setSelectedMember({ ...m, type: 'CONTRIBUTION' })}
                                        >
                                            <User size={16} />
                                            <span className="member-name">{m.name}</span>
                                            <span className="member-remaining">₹{m.remainingAmount}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Winner payout pending */}
                        {pendingData.payoutPending && (
                            <div className="form-group">
                                <label>Winner Payout Pending</label>
                                <button
                                    type="button"
                                    className={`member-item winner-item ${selectedMember?.userId === pendingData.payoutPending.userId ? 'selected' : ''}`}
                                    onClick={() => setSelectedMember({ ...pendingData.payoutPending, type: 'WINNER_PAYOUT' })}
                                >
                                    <Award size={16} />
                                    <span className="member-name">{pendingData.payoutPending.name}</span>
                                    <span className="member-remaining">₹{pendingData.payoutPending.remainingAmount}</span>
                                </button>
                            </div>
                        )}
                    </>
                )}

                {validationErrors.member && <span className="field-error">{validationErrors.member}</span>}

                {/* Amount */}
                <div className="form-group">
                    <label>Amount (₹) *</label>
                    <div className="input-wrapper">
                        <IndianRupee size={18} className="input-icon" />
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            min="1"
                            step="1"
                            disabled={!selectedMember || submitting}
                            className={validationErrors.amount ? 'error' : ''}
                        />
                    </div>
                    {validationErrors.amount && <span className="field-error">{validationErrors.amount}</span>}
                    {selectedMember && (
                        <small className="remaining-hint">Remaining: ₹{selectedMember.remainingAmount}</small>
                    )}
                </div>

                {/* Payment Mode */}
                <div className="form-group">
                    <label>Payment Mode *</label>
                    <div className="select-wrapper">
                        <FileText size={18} className="input-icon" />
                        <select
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                            disabled={submitting}
                            className={validationErrors.paymentMode ? 'error' : ''}
                        >
                            <option value="">-- Select mode --</option>
                            {paymentModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                        </select>
                    </div>
                    {validationErrors.paymentMode && <span className="field-error">{validationErrors.paymentMode}</span>}
                </div>

                {/* Collection Date */}
                <div className="form-group">
                    <label>Collection Date (optional)</label>
                    <div className="input-wrapper">
                        <Calendar size={18} className="input-icon" />
                        <input
                            type="date"
                            value={collectedAt}
                            onChange={(e) => setCollectedAt(e.target.value)}
                            disabled={submitting}
                            max={new Date().toISOString().split('T')[0]}
                            className={validationErrors.collectedAt ? 'error' : ''}
                        />
                    </div>
                    {validationErrors.collectedAt && <span className="field-error">{validationErrors.collectedAt}</span>}
                </div>

                {/* Remarks */}
                <div className="form-group">
                    <label>Remarks (optional)</label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Any additional notes"
                        rows="3"
                        disabled={submitting}
                    />
                </div>

                {/* Submit */}
                <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={() => navigate('/employee/dashboard')} disabled={submitting}>
                        Cancel
                    </button>
                    <button type="submit" className="submit-btn" disabled={submitting}>
                        {submitting ? <><Loader size={18} className="spinner" /> Logging...</> : 'Log Payment'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LogContribution;