import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import {
    ArrowLeft,
    Calendar,
    Users,
    DollarSign,
    Clock,
    Activity,
    ChevronDown,
    ChevronUp,
    X
} from 'lucide-react';
import './GroupDetails.css';

const GroupDetails = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedMember, setSelectedMember] = useState(null); // for history modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    useEffect(() => {
        fetchGroupDetails();
    }, [groupId]);

    const fetchGroupDetails = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await adminApi.groups.details(groupId);
            setGroupData(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch group details');
            console.error('Group details error:', err);
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
            case 'ACTIVE': return 'status-badge active';
            case 'DRAFT': return 'status-badge draft';
            case 'COMPLETED': return 'status-badge completed';
            default: return 'status-badge';
        }
    };

    const openHistoryModal = (member) => {
        setSelectedMember(member);
        setShowHistoryModal(true);
    };

    const closeHistoryModal = () => {
        setShowHistoryModal(false);
        setSelectedMember(null);
    };

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

    return (
        <div className="group-details-page">
            {/* Header with back button */}
            <div className="group-details-header">
                <button className="back-btn" onClick={() => navigate('/admin/groups')}>
                    <ArrowLeft size={18} />
                    Back to Groups
                </button>
                <h1 className="page-title">{group.name}</h1>
                <div className="group-status-wrapper">
                    <span className={getStatusBadgeClass(group.status)}>{group.status}</span>
                </div>
            </div>

            {/* Group Info Cards */}
            <div className="info-cards">
                <div className="info-card">
                    <div className="info-icon"><Calendar size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Created</span>
                        <span className="info-value">{formatDate(group.createdAt)}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><Activity size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Started</span>
                        <span className="info-value">{formatDate(group.startDate)}</span>
                    </div>
                </div>
                <div className="info-card">
                    <div className="info-icon"><Users size={20} /></div>
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
                    <div className="info-icon"><DollarSign size={20} /></div>
                    <div className="info-content">
                        <span className="info-label">Monthly Contribution</span>
                        <span className="info-value">{formatCurrency(group.monthlyContribution)}</span>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="financial-section">
                <h2 className="section-title">Financial Summary</h2>
                <div className="financial-grid">
                    <div className="financial-card">
                        <div className="financial-label">Monthly Pool</div>
                        <div className="financial-value">{formatCurrency(financialSummary.monthlyPool)}</div>
                    </div>
                    <div className="financial-card">
                        <div className="financial-label">Expected Till Now</div>
                        <div className="financial-value">{formatCurrency(financialSummary.totalExpectedTillNow)}</div>
                    </div>
                    <div className="financial-card">
                        <div className="financial-label">Total Collected</div>
                        <div className="financial-value">{formatCurrency(financialSummary.totalCollected)}</div>
                    </div>
                    <div className="financial-card">
                        <div className="financial-label">Current Month Collection</div>
                        <div className="financial-value">{formatCurrency(financialSummary.currentMonthCollection)}</div>
                    </div>
                    <div className="financial-card">
                        <div className="financial-label">Total Rotated</div>
                        <div className="financial-value">{formatCurrency(financialSummary.totalRotated)}</div>
                    </div>
                </div>
            </div>

            {/* Members Table */}
            <div className="members-section">
                <h2 className="section-title">Members</h2>
                <div className="members-table-container">
                    <table className="members-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Total Paid</th>
                                <th>Expected Till Now</th>
                                <th>Pending</th>
                                <th>Has Won</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member) => (
                                <tr key={member.userId}>
                                    <td className="member-name">{member.name}</td>
                                    <td>{formatCurrency(member.totalPaid)}</td>
                                    <td>{formatCurrency(member.expectedTillNow)}</td>
                                    <td className={member.pendingAmount > 0 ? 'pending' : 'paid'}>
                                        {formatCurrency(member.pendingAmount)}
                                    </td>
                                    <td>
                                        {member.hasWon ? (
                                            <span className="won-badge">✓ Won</span>
                                        ) : (
                                            <span className="not-won-badge">—</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="history-btn"
                                            onClick={() => openHistoryModal(member)}
                                        >
                                            View History
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* History Modal */}
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
                                            <th>Month</th>
                                            <th>Amount</th>
                                            <th>Mode</th>
                                            <th>Collected By</th>
                                            <th>Date</th>
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
        </div>
    );
};

export default GroupDetails;