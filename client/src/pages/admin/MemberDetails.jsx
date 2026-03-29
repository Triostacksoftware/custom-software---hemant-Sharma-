import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, IndianRupee, Folder, CheckCircle, AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Members.css'; // Reuses the same CSS file for consistency

const MemberDetails = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [details, setDetails] = useState(null);
    const [expandedGroup, setExpandedGroup] = useState(null); // Track which group's payment history is open

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await adminApi.users.details(userId);
                if (response.data.success) {
                    setDetails(response.data.data);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load member details.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [userId]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const toggleGroupHistory = (groupId) => {
        if (expandedGroup === groupId) {
            setExpandedGroup(null);
        } else {
            setExpandedGroup(groupId);
        }
    };

    if (loading) {
        return (
            <div className="admin-members-container center-content">
                <div className="spinner"></div>
                <p className="loading-text">Loading member profile...</p>
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="admin-members-container center-content">
                <p className="error-text">{error || 'Member not found.'}</p>
                <button className="elder-btn-primary" onClick={() => navigate('/admin/members')}>Back to Directory</button>
            </div>
        );
    }

    const { user, financialSummary, groups } = details;

    return (
        <div className="admin-members-container">
            {/* Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/members')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Member Profile</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="members-main-content">

                {/* TOP SECTION: User Info & Global Stats */}
                <div className="details-top-grid">

                    {/* User Profile Card */}
                    <div className="profile-summary-card">
                        <div className="profile-avatar icon-slate">
                            <User size={40} />
                        </div>
                        <div className="profile-info">
                            <h2>{user.name}</h2>
                            <p className="phone-text">{user.phoneNumber || user.phone || 'No phone provided'}</p>
                            <span className={`status-badge ${user.approvalStatus === 'APPROVED' ? 'badge-success' : 'badge-warning'}`}>
                                {user.approvalStatus}
                            </span>
                        </div>
                    </div>

                    {/* Financial Summary Card */}
                    <div className="global-stats-card">
                        <div className="stat-box">
                            <div className="stat-icon icon-slate"><Folder size={20} /></div>
                            <div className="stat-text">
                                <p>Active Groups</p>
                                <h3>{financialSummary.totalGroups}</h3>
                            </div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-icon icon-emerald"><IndianRupee size={20} /></div>
                            <div className="stat-text">
                                <p>Total Contributed (Lifetime)</p>
                                <h3>{formatCurrency(financialSummary.totalPaidAcrossGroups)}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="admin-divider"></div>

                {/* BOTTOM SECTION: Group Breakdown */}
                <h2 className="section-heading">Group Memberships & Financials</h2>

                {groups.length === 0 ? (
                    <div className="elder-empty-card">
                        <Folder size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
                        <p>This member is not part of any groups.</p>
                    </div>
                ) : (
                    <div className="group-details-list">
                        {groups.map((group) => (
                            <div key={group.groupId} className="detailed-group-card">

                                {/* Group Header */}
                                <div className="group-card-header">
                                    <div className="group-header-info">
                                        <h3>{group.groupName}</h3>
                                        <span className={`status-badge ${group.groupStatus === 'ACTIVE' ? 'badge-success' : 'badge-slate'}`}>
                                            {group.groupStatus}
                                        </span>
                                    </div>
                                    <div className="group-header-meta">
                                        <span className="meta-pill">Month {group.currentMonth}</span>
                                        <span className="meta-pill">{formatCurrency(group.monthlyContribution)} / mo</span>
                                    </div>
                                </div>

                                {/* Financial Breakdown Grid */}
                                <div className="group-financial-grid">
                                    <div className="fin-box">
                                        <p>Expected Contrib.</p>
                                        <h4>{formatCurrency(group.expectedTillNow)}</h4>
                                    </div>
                                    <div className="fin-box text-blue">
                                        <p>Total Paid</p>
                                        <h4>{formatCurrency(group.totalPaidInGroup)}</h4>
                                    </div>
                                    <div className={`fin-box ${group.pendingAmount > 0 ? 'alert-box text-red' : 'success-box text-green'}`}>
                                        <p>{group.pendingAmount > 0 ? <AlertTriangle size={14} /> : <CheckCircle size={14} />} Pending Dues</p>
                                        <h4>{formatCurrency(group.pendingAmount)}</h4>
                                    </div>
                                    <div className="fin-box text-emerald">
                                        <p>Payout Received</p>
                                        <h4>{group.hasWon ? formatCurrency(group.totalReceivedInGroup) : 'Not Won Yet'}</h4>
                                    </div>
                                </div>

                                {/* Toggle History Button */}
                                <button
                                    className="toggle-history-btn"
                                    onClick={() => toggleGroupHistory(group.groupId)}
                                >
                                    {expandedGroup === group.groupId ? (
                                        <><ChevronUp size={18} /> Hide Payment History</>
                                    ) : (
                                        <><ChevronDown size={18} /> View Payment History ({group.paymentHistory.length})</>
                                    )}
                                </button>

                                {/* Collapsible History Section */}
                                {expandedGroup === group.groupId && (
                                    <div className="group-history-section">
                                        {group.paymentHistory.length === 0 ? (
                                            <p className="no-history-text">No completed transactions found for this group.</p>
                                        ) : (
                                            <div className="mini-history-list">
                                                {/* Sort history by date descending */}
                                                {[...group.paymentHistory].sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt)).map((tx, idx) => {
                                                    const isContribution = tx.type === 'CONTRIBUTION';
                                                    return (
                                                        <div key={idx} className="mini-tx-row">
                                                            <div className="mini-tx-left">
                                                                <div className={`mini-icon ${isContribution ? 'bg-blue-light' : 'bg-green-light'}`}>
                                                                    {isContribution ? <ArrowUpRight size={16} color="#2563eb" /> : <ArrowDownLeft size={16} color="#059669" />}
                                                                </div>
                                                                <div className="mini-tx-info">
                                                                    <p className="tx-type">{isContribution ? `Month ${tx.monthNumber} Contribution` : 'Winning Payout'}</p>
                                                                    <p className="tx-meta">{formatDateTime(tx.collectedAt)} • Collected by {tx.collectorName || 'Admin'}</p>
                                                                    {tx.remarks && <p className="tx-meta italic">"{tx.remarks}"</p>}
                                                                </div>
                                                            </div>
                                                            <div className={`mini-tx-right ${isContribution ? 'text-blue' : 'text-emerald'}`}>
                                                                {isContribution ? '-' : '+'}{formatCurrency(tx.amountPaid)}
                                                                <span className="pay-mode">{tx.paymentMode}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default MemberDetails;