import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import {
    ChevronLeft,
    User,
    Phone,
    Calendar,
    IndianRupee,
    Users,
    Award,
    ChevronRight,
    X
} from 'lucide-react';
import './MemberDetails.css';

const MemberDetails = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [memberData, setMemberData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    useEffect(() => {
        fetchMemberDetails();
    }, [userId]);

    const fetchMemberDetails = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await adminApi.users.details(userId);
            setMemberData(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch member details');
            console.error('Member details error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'APPROVED':
                return 'status-badge approved';
            case 'PENDING':
                return 'status-badge pending';
            case 'REJECTED':
                return 'status-badge rejected';
            default:
                return 'status-badge';
        }
    };

    const getGroupStatusBadgeClass = (status) => {
        switch (status) {
            case 'ACTIVE':
                return 'group-status active';
            case 'DRAFT':
                return 'group-status draft';
            case 'COMPLETED':
                return 'group-status completed';
            default:
                return 'group-status';
        }
    };

    const openHistoryModal = (group) => {
        setSelectedGroup(group);
        setShowHistoryModal(true);
    };

    const closeHistoryModal = () => {
        setShowHistoryModal(false);
        setSelectedGroup(null);
    };

    if (loading) {
        return (
            <div className="member-details-loading">
                <div className="spinner"></div>
                <p>Loading member details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="member-details-error">
                <strong>Error:</strong> {error}
                <button onClick={fetchMemberDetails}>Retry</button>
            </div>
        );
    }

    if (!memberData) return null;

    const { user, financialSummary, groups } = memberData;

    return (
        <div className="member-details-page">
            {/* Header with back button */}
            <div className="member-details-header">
                <button className="back-btn" onClick={() => navigate('/admin/members')}>
                    <ChevronLeft size={18} />
                    Back
                </button>
                <h1 className="page-title">Member Details</h1>
                <div className="member-status-wrapper">
                    <span className={getStatusBadgeClass(user.approvalStatus)}>
                        {user.approvalStatus}
                    </span>
                </div>
            </div>

            {/* Member Info Cards */}
            <div className="info-cards">
                <div className="info-card">
                    <div className="info-icon"><User size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Name</span>
                        <span className="info-value">{user.name}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><Phone size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Phone Number</span>
                        <span className="info-value">{user.phoneNumber}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><Calendar size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Registered On</span>
                        <span className="info-value">{formatDate(user.createdAt)}</span>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="financial-section">
                <h2 className="section-title">Financial Summary</h2>
                <div className="financial-grid">
                    <div className="financial-card">
                        <div className="financial-icon"><IndianRupee size={20} /></div>
                        <div className="financial-content">
                            <span className="financial-label">Total Paid Across Groups</span>
                            <span className="financial-value">{formatCurrency(financialSummary.totalPaidAcrossGroups)}</span>
                        </div>
                    </div>
                    <div className="financial-card">
                        <div className="financial-icon"><Users size={20} /></div>
                        <div className="financial-content">
                            <span className="financial-label">Groups Enrolled</span>
                            <span className="financial-value">{financialSummary.totalGroups}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Groups Table */}
            <div className="groups-section">
                <h2 className="section-title">Groups</h2>
                {groups.length === 0 ? (
                    <div className="no-groups">Not enrolled in any group yet.</div>
                ) : (
                    <div className="groups-table-container">
                        <table className="groups-table">
                            <thead>
                                <tr>
                                    <th>Group Name</th>
                                    <th>Status</th>
                                    <th>Monthly Contribution</th>
                                    <th>Expected Till Now</th>
                                    <th>Paid</th>
                                    <th>Pending</th>
                                    <th>Has Won</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((group) => (
                                    <tr key={group.groupId}>
                                        <td className="group-name">
                                            <button
                                                className="group-link-btn"
                                                onClick={() => navigate(`/admin/group/${group.groupId}`)}
                                            >
                                                {group.groupName}
                                                <ChevronRight size={14} />
                                            </button>
                                        </td>
                                        <td>
                                            <span className={getGroupStatusBadgeClass(group.groupStatus)}>
                                                {group.groupStatus}
                                            </span>
                                        </td>
                                        <td>{formatCurrency(group.monthlyContribution)}</td>
                                        <td>{formatCurrency(group.expectedTillNow)}</td>
                                        <td className={group.totalPaidInGroup > 0 ? 'paid' : ''}>
                                            {formatCurrency(group.totalPaidInGroup)}
                                        </td>
                                        <td className={group.pendingAmount > 0 ? 'pending' : 'paid'}>
                                            {formatCurrency(group.pendingAmount)}
                                        </td>
                                        <td>
                                            {group.hasWon ? (
                                                <span className="won-badge">
                                                    <Award size={14} />
                                                    {group.winningMonth ? `Month ${group.winningMonth}` : 'Yes'}
                                                </span>
                                            ) : (
                                                <span className="not-won-badge">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="history-btn"
                                                onClick={() => openHistoryModal(group)}
                                            >
                                                History
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment History Modal */}
            {showHistoryModal && selectedGroup && (
                <div className="modal-overlay" onClick={closeHistoryModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                Payment History – {selectedGroup.groupName}
                                <span className="modal-subtitle">{user.name}</span>
                            </h3>
                            <button className="modal-close" onClick={closeHistoryModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {selectedGroup.paymentHistory.length === 0 ? (
                                <p className="no-history">No payment records for this group.</p>
                            ) : (
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Amount</th>
                                            <th>Mode</th>
                                            <th>Collected By</th>
                                            <th>Date</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedGroup.paymentHistory.map((entry, idx) => (
                                            <tr key={idx}>
                                                <td>Month {entry.monthNumber}</td>
                                                <td>{formatCurrency(entry.amountPaid)}</td>
                                                <td>{entry.paymentMode}</td>
                                                <td>{entry.collectorName || '—'}</td>
                                                <td>{formatDate(entry.collectedAt)}</td>
                                                <td className="remarks-cell">{entry.remarks || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemberDetails;