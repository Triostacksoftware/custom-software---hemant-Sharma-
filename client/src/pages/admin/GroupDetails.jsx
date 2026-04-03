import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Folder, IndianRupee, Plus, Search, PlayCircle, TrendingDown, TrendingUp, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Groups.css';

const GroupDetailsAdmin = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Add Member Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [availableMembers, setAvailableMembers] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Add Member Confirmation States
    const [confirmAddModal, setConfirmAddModal] = useState({ show: false, userId: null, name: '' });

    const fetchDetails = async () => {
        try {
            const response = await adminApi.groups.details(groupId);
            if (response.data.success) setData(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const handleActivate = async () => {
        if (!window.confirm("Are you sure you want to activate this group? Bidding rounds will begin.")) return;
        setActionLoading(true);
        try {
            await adminApi.groups.activate(groupId);
            fetchDetails();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to activate group');
        } finally {
            setActionLoading(false);
        }
    };

    // Load available members (excluding those already in the group)
    const loadAvailableMembers = useCallback(async (search = '') => {
        if (!data) return;
        setSearchLoading(true);
        try {
            // Fetch top 50 approved users
            const res = await adminApi.users.fetchAll({ search, limit: 50 });
            if (res.data.success) {
                const existingIds = data.members.map(m => m.userId);
                const available = res.data.data.members.filter(u => u.approvalStatus === 'APPROVED' && !existingIds.includes(u._id));
                setAvailableMembers(available);
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setSearchLoading(false);
        }
    }, [data]);

    // When Add Modal opens, fetch the default list
    const openAddModal = () => {
        setShowAddModal(true);
        setSearchQuery('');
        loadAvailableMembers('');
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadAvailableMembers(searchQuery);
    };

    // Triggers the inner confirmation modal
    const triggerAddConfirm = (userId, name) => {
        setConfirmAddModal({ show: true, userId, name });
    };

    // Executes the actual API call
    const executeAddMember = async () => {
        const { userId } = confirmAddModal;
        setConfirmAddModal({ show: false, userId: null, name: '' });

        // Optimistically remove user from available list to prevent double clicks
        setAvailableMembers(prev => prev.filter(m => m._id !== userId));

        try {
            await adminApi.groups.addMember(groupId, userId);
            // Refresh data behind the scenes
            await fetchDetails();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add member');
            // Re-fetch search list just in case it failed, so they re-appear
            loadAvailableMembers(searchQuery);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    if (loading) return <div className="admin-groups-container center-content"><div className="spinner"></div></div>;
    if (error || !data) return <div className="admin-groups-container center-content"><p className="error-text">{error}</p><button className="elder-btn-primary" onClick={() => navigate('/admin/groups')}>Back</button></div>;

    const { group, financialSummary, members } = data;
    const isDraft = group.status === 'DRAFT';

    // Group is full when members length matches totalMembers MINUS 1 (Admin)
    const isFull = group.totalMembers === members.length + 1;

    return (
        <div className="admin-groups-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/groups')}><ArrowLeft size={24} /> <span>Back</span></button>
                </div>
                <div className="header-center"><h1 className="page-title">{group.name}</h1></div>
                <div className="header-right">
                    {isDraft && isFull && (
                        <button className="elder-btn-success-solid" onClick={handleActivate} disabled={actionLoading}>
                            {actionLoading ? 'Activating...' : <><PlayCircle size={20} /> Activate Group</>}
                        </button>
                    )}
                </div>
            </header>

            <main className="groups-main-content">

                {/* Stats Grid */}
                <div className="group-stats-overview">
                    <div className="g-stat-box">
                        <p>Current Status</p>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span className={`status-badge ${group.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>{group.status}</span>
                            {group.status === 'ACTIVE' && <span className="status-badge badge-slate">Month {group.currentMonth}</span>}
                        </div>
                    </div>
                    <div className="g-stat-box">
                        <p>Group Capacity</p>
                        {/* Add +1 to capacity to include Admin */}
                        <h4>{members.length + 1} / {group.totalMembers}</h4>
                    </div>
                    <div className="g-stat-box bg-red-light border-red">
                        <p className="text-red flex-align"><TrendingDown size={16} /> Pending Collection (Month)</p>
                        <h4 className="text-red">{formatCurrency(financialSummary.groupPendingCollectionThisMonth)}</h4>
                    </div>
                    <div className="g-stat-box bg-green-light border-green">
                        <p className="text-green flex-align"><TrendingUp size={16} /> Pending Payout (Month)</p>
                        <h4 className="text-green">{formatCurrency(financialSummary.groupPendingPayoutThisMonth)}</h4>
                    </div>
                </div>

                <div className="section-header-flex" style={{ marginTop: '3rem' }}>
                    <h2 className="elder-section-title">Group Members</h2>
                    {isDraft && !isFull && (
                        <button className="elder-btn-primary" onClick={openAddModal}>
                            <Plus size={20} /> Add Member
                        </button>
                    )}
                </div>

                {members.length === 0 ? (
                    <div className="elder-empty-card"><Users size={48} opacity={0.3} /><p>No members added to this group yet.</p></div>
                ) : (
                    <div className="elder-list-container">
                        {members.map((m) => (
                            <div key={m.userId} className="elder-list-card">
                                <div className="list-card-left">
                                    <div className="icon-wrapper icon-slate"><User size={26} /></div>
                                    <div className="list-card-info">
                                        <div className="title-with-status">
                                            <h3 className="elder-card-title">{m.name}</h3>
                                            {m.hasWon ? (
                                                <span className="status-badge badge-success">👑 Winner (Month {m.winningMonth})</span>
                                            ) : (
                                                <span className="status-badge badge-slate">Not Won Yet</span>
                                            )}
                                        </div>

                                        <div className="person-details-inline">
                                            <span className="detail-text">{m.phone || 'No phone'}</span>
                                            <span className="stat-divider">•</span>
                                            <span className="detail-text">Total Paid: {formatCurrency(m.totalPaid)}</span>
                                        </div>

                                        {/* Current Month Dues Highlight */}
                                        <div className="person-details-inline mt-2">
                                            {m.currentMonthPendingContribution > 0 && (
                                                <span className="current-due-badge due-pay">
                                                    Owes this month: {formatCurrency(m.currentMonthPendingContribution)}
                                                </span>
                                            )}
                                            {m.currentMonthPendingPayout > 0 && (
                                                <span className="current-due-badge due-receive">
                                                    Receives this month: {formatCurrency(m.currentMonthPendingPayout)}
                                                </span>
                                            )}
                                            {m.currentMonthPendingContribution === 0 && m.currentMonthPendingPayout === 0 && group.status === 'ACTIVE' && (
                                                <span className="current-due-badge due-clear">
                                                    <CheckCircle size={14} /> Clear for this month
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Add Member Master Modal */}
            {showAddModal && (
                <div className="elder-modal-overlay">
                    <div className="elder-modal-card add-member-modal">
                        <h3>Add Member to Group</h3>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Select from available approved members.</p>

                        <form className="admin-search-form modal-search" onSubmit={handleSearchSubmit}>
                            <div className="admin-search-input-wrapper">
                                <Search size={20} className="admin-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    className="admin-search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="admin-search-submit-btn">Search</button>
                        </form>

                        <div className="modal-results-area">
                            {searchLoading ? (
                                <div className="spinner" style={{ margin: '2rem auto' }}></div>
                            ) : availableMembers.length === 0 ? (
                                <div className="empty-search-state">
                                    <Users size={32} opacity={0.3} />
                                    <p>{searchQuery ? 'No members match your search.' : 'No available members left to add.'}</p>
                                </div>
                            ) : (
                                <div className="search-results-list">
                                    {availableMembers.map(u => (
                                        <div key={u._id} className="search-result-row">
                                            <div className="res-left">
                                                <div className="res-icon"><User size={20} /></div>
                                                <div className="res-info">
                                                    <strong>{u.name}</strong>
                                                    <span>{u.phoneNumber || 'No Phone'}</span>
                                                </div>
                                            </div>
                                            <button
                                                className="elder-btn-success-outline"
                                                onClick={() => triggerAddConfirm(u._id, u.name)}
                                            >
                                                <Plus size={16} /> Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button className="elder-btn-secondary full-width mt-1" onClick={() => setShowAddModal(false)}>Close Window</button>
                    </div>
                </div>
            )}

            {/* Nested Confirmation Modal for Adding Member */}
            {confirmAddModal.show && (
                <div className="elder-modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="elder-modal-card" style={{ maxWidth: '380px' }}>
                        <div className="modal-icon bg-blue-light">
                            <Plus size={32} color="#2563eb" />
                        </div>
                        <h3>Confirm Addition</h3>
                        <p style={{ marginBottom: '1.5rem' }}>
                            Are you sure you want to add <strong>{confirmAddModal.name}</strong> to this group?
                        </p>
                        <div className="elder-modal-actions">
                            <button className="elder-btn-secondary" onClick={() => setConfirmAddModal({ show: false, userId: null, name: '' })}>Cancel</button>
                            <button className="elder-btn-success-solid" onClick={executeAddMember}>
                                <CheckCircle size={18} /> Yes, Add Member
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDetailsAdmin;