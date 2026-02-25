import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { employeeApi } from '../../api/employeeApi';
import { Calendar, IndianRupee, User, Users, FileText, CheckCircle, AlertCircle, Loader, Info } from 'lucide-react';
import './LogContribution.css';

const LogContribution = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Pre-selected group ID from navigation state (passed by dashboard)
    const preselectedGroupId = location.state?.groupId;

    // Groups from API
    const [groups, setGroups] = useState([]);
    const [pendingMembersData, setPendingMembersData] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
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

    // Fetch active groups on mount
    useEffect(() => {
        fetchGroups();
    }, []);

    // After groups are loaded, if a preselected groupId exists, select it
    useEffect(() => {
        if (groups.length > 0 && preselectedGroupId) {
            const groupExists = groups.some(g => g._id === preselectedGroupId);
            if (groupExists) {
                setSelectedGroupId(preselectedGroupId);
            }
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
            console.error(err);
        } finally {
            setLoadingGroups(false);
        }
    };

    // Fetch pending members when group changes
    useEffect(() => {
        if (!selectedGroupId) {
            setPendingMembersData(null);
            setSelectedUserId('');
            setAmount('');
            return;
        }

        const fetchPending = async () => {
            setLoadingPending(true);
            setError('');
            setPendingMembersData(null);
            try {
                const response = await employeeApi.getPendingMembers(selectedGroupId);
                setPendingMembersData(response.data);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load pending members.');
                console.error(err);
            } finally {
                setLoadingPending(false);
            }
        };

        fetchPending();
    }, [selectedGroupId]);

    // When member changes, prefill amount with remaining amount
    useEffect(() => {
        if (selectedUserId && pendingMembersData) {
            const selectedMember = pendingMembersData.pendingMembers.find(m => m.userId === selectedUserId);
            if (selectedMember) {
                setAmount(selectedMember.remainingAmount.toString());
            }
        } else {
            setAmount('');
        }
    }, [selectedUserId, pendingMembersData]);

    // Validate form
    const validateForm = () => {
        const errors = {};

        if (!selectedGroupId) errors.groupId = 'Please select a group';
        if (!selectedUserId) errors.userId = 'Please select a member';
        if (!amount) {
            errors.amount = 'Amount is required';
        } else if (isNaN(amount) || Number(amount) <= 0) {
            errors.amount = 'Amount must be a positive number';
        } else if (pendingMembersData) {
            const selectedMember = pendingMembersData.pendingMembers.find(m => m.userId === selectedUserId);
            if (selectedMember && Number(amount) > selectedMember.remainingAmount) {
                errors.amount = `Amount cannot exceed remaining ₹${selectedMember.remainingAmount}`;
            }
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
            userId: selectedUserId,
            monthNumber: pendingMembersData?.currentMonth,
            amountPaid: Number(amount),
            paymentMode,
            remarks: remarks.trim() || undefined,
            collectedAt: collectedAt || undefined,
        };

        try {
            await employeeApi.logContribution(payload);
            setSuccess('Contribution logged successfully!');

            // Reset member selection and amount, keep group selected
            setSelectedUserId('');
            setAmount('');
            setPaymentMode('');
            setRemarks('');

            // Refresh pending members list
            const response = await employeeApi.getPendingMembers(selectedGroupId);
            setPendingMembersData(response.data);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to log contribution. Please try again.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const paymentModes = ['CASH', 'UPI', 'INTERNET_BANKING', 'CHEQUE'];

    return (
        <div className="log-contribution-page">
            <h1 className="page-title">Log Contribution</h1>
            <p className="page-subtitle">Record a member's monthly contribution</p>

            {error && (
                <div className="error-message">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="success-message">
                    <CheckCircle size={18} />
                    <span>{success}</span>
                </div>
            )}

            <form className="contribution-form" onSubmit={handleSubmit}>
                {/* Group Selection */}
                <div className="form-group">
                    <label htmlFor="group">Select Group *</label>
                    <div className="select-wrapper">
                        <Users size={18} className="input-icon" />
                        <select
                            id="group"
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            disabled={loadingGroups || submitting}
                            className={validationErrors.groupId ? 'error' : ''}
                        >
                            <option value="">-- Choose a group --</option>
                            {groups.map(group => (
                                <option key={group._id} value={group._id}>
                                    {group.name} (Month {group.currentMonth})
                                </option>
                            ))}
                        </select>
                    </div>
                    {validationErrors.groupId && (
                        <span className="field-error">{validationErrors.groupId}</span>
                    )}
                    {loadingGroups && (
                        <div className="inline-loader">
                            <Loader size={16} className="spinner" />
                            <span>Loading groups...</span>
                        </div>
                    )}
                </div>

                {/* Pending Members Info */}
                {pendingMembersData && (
                    <div className="info-box">
                        <div className="info-header">
                            <Info size={16} />
                            <span>Group: {pendingMembersData.groupName}</span>
                        </div>
                        <div className="info-details">
                            <p><strong>Current Month:</strong> {pendingMembersData.currentMonth}</p>
                            <p><strong>Monthly Contribution:</strong> ₹{pendingMembersData.monthlyContribution?.toLocaleString()}</p>
                            <p><strong>Pending Members:</strong> {pendingMembersData.pendingCount}</p>
                        </div>
                    </div>
                )}

                {/* Member Selection */}
                <div className="form-group">
                    <label htmlFor="member">Select Member *</label>
                    <div className="select-wrapper">
                        <User size={18} className="input-icon" />
                        <select
                            id="member"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            disabled={!selectedGroupId || loadingPending || submitting}
                            className={validationErrors.userId ? 'error' : ''}
                        >
                            <option value="">-- Choose a member --</option>
                            {pendingMembersData?.pendingMembers.map(member => (
                                <option key={member.userId} value={member.userId}>
                                    {member.name} - ₹{member.remainingAmount} remaining
                                </option>
                            ))}
                        </select>
                    </div>
                    {validationErrors.userId && (
                        <span className="field-error">{validationErrors.userId}</span>
                    )}
                    {loadingPending && (
                        <div className="inline-loader">
                            <Loader size={16} className="spinner" />
                            <span>Loading pending members...</span>
                        </div>
                    )}
                </div>

                {/* Amount */}
                <div className="form-group">
                    <label htmlFor="amount">Amount Paid (₹) *</label>
                    <div className="input-wrapper">
                        <IndianRupee size={18} className="input-icon" />
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            min="1"
                            step="1"
                            disabled={submitting || !selectedUserId}
                            className={validationErrors.amount ? 'error' : ''}
                        />
                    </div>
                    {validationErrors.amount && (
                        <span className="field-error">{validationErrors.amount}</span>
                    )}
                    {selectedUserId && pendingMembersData && (
                        <small className="remaining-hint">
                            Remaining: ₹{pendingMembersData.pendingMembers.find(m => m.userId === selectedUserId)?.remainingAmount}
                        </small>
                    )}
                </div>

                {/* Payment Mode */}
                <div className="form-group">
                    <label htmlFor="paymentMode">Payment Mode *</label>
                    <div className="select-wrapper">
                        <FileText size={18} className="input-icon" />
                        <select
                            id="paymentMode"
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
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

                {/* Collection Date */}
                <div className="form-group">
                    <label htmlFor="collectedAt">Collection Date (optional)</label>
                    <div className="input-wrapper">
                        <Calendar size={18} className="input-icon" />
                        <input
                            type="date"
                            id="collectedAt"
                            value={collectedAt}
                            onChange={(e) => setCollectedAt(e.target.value)}
                            disabled={submitting}
                            max={new Date().toISOString().split('T')[0]}
                            className={validationErrors.collectedAt ? 'error' : ''}
                        />
                    </div>
                    {validationErrors.collectedAt && (
                        <span className="field-error">{validationErrors.collectedAt}</span>
                    )}
                </div>

                {/* Remarks */}
                <div className="form-group">
                    <label htmlFor="remarks">Remarks (optional)</label>
                    <textarea
                        id="remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Any additional notes"
                        rows="3"
                        disabled={submitting}
                    />
                </div>

                {/* Submit Button */}
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
                        {submitting ? (
                            <>
                                <Loader size={18} className="spinner" />
                                Logging...
                            </>
                        ) : (
                            'Log Contribution'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LogContribution;