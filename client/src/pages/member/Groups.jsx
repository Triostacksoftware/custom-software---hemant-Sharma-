import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { userApi } from '../../api/userApi';
import './Groups.css';

const GroupsMembers = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [groupsData, setGroupsData] = useState({ myGroups: [], availableGroups: [] });

    // States for handling the join request and confirmation modal
    const [requestingId, setRequestingId] = useState(null);
    const [confirmGroup, setConfirmGroup] = useState(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await userApi.getAllGroups();
            if (response.data.success) {
                setGroupsData(response.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const confirmJoinRequest = async () => {
        if (!confirmGroup) return;

        const groupId = confirmGroup._id;

        try {
            setRequestingId(groupId);
            setConfirmGroup(null); // Close modal immediately
            const response = await userApi.requestToJoinGroup(groupId);

            if (response.data.success) {
                setGroupsData(prev => ({
                    ...prev,
                    availableGroups: prev.availableGroups.map(group =>
                        group._id === groupId ? { ...group, hasRequestedToJoin: true } : group
                    )
                }));
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to send join request');
        } finally {
            setRequestingId(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="elder-groups-container center-content">
                <div className="spinner"></div>
                <p className="loading-text">Loading your groups...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="elder-groups-container center-content">
                <p className="error-text">{error}</p>
                <button className="elder-btn-primary" onClick={fetchGroups}>Try Again</button>
            </div>
        );
    }

    return (
        <div className="elder-groups-container">
            {/* Unified Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/user/dashboard')}>
                        <ArrowLeft size={24} />
                        <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Groups</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="groups-main-content">

                {/* Section 1: My Groups */}
                <section className="elder-section">
                    <h2 className="elder-section-title">Groups You Are In</h2>

                    {groupsData.myGroups.length === 0 ? (
                        <div className="elder-empty-card">
                            <p>You have not joined any groups yet.</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {groupsData.myGroups.map((group) => (
                                <div
                                    key={group._id}
                                    className="elder-list-card clickable-card"
                                    onClick={() => navigate(`/user/group/${group._id}`)}
                                >
                                    <div className="list-card-left">
                                        <div className="icon-wrapper blue-icon"><Users size={24} /></div>
                                        <div className="list-card-info">
                                            <h3 className="elder-card-title">{group.name}</h3>
                                            <div className="elder-stats-inline">
                                                <span className="stat-value green-text">
                                                    Monthly Contribution: {formatCurrency(group.monthlyContribution)}
                                                </span>
                                                <span className="stat-divider">•</span>
                                                <span className="stat-value">
                                                    {group.currentMemberCount || 0}/{group.totalMembers || 0} Members
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="list-card-right">
                                        <ArrowRight size={24} className="action-arrow" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <div className="elder-divider"></div>

                {/* Section 2: Available Groups */}
                <section className="elder-section">
                    <h2 className="elder-section-title">New Groups You Can Join</h2>

                    {groupsData.availableGroups.length === 0 ? (
                        <div className="elder-empty-card">
                            <p>There are no new groups available right now.</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {groupsData.availableGroups.map((group) => (
                                <div key={group._id} className="elder-list-card available-group-card">
                                    <div className="list-card-left">
                                        <div className="icon-wrapper green-icon"><Users size={24} /></div>
                                        <div className="list-card-info">
                                            <h3 className="elder-card-title">{group.name}</h3>
                                            <div className="elder-stats-inline">
                                                <span className="stat-value green-text">
                                                    Monthly Contribution: {formatCurrency(group.monthlyContribution)}
                                                </span>
                                                <span className="stat-divider">•</span>
                                                <span className="stat-value">
                                                    {group.currentMemberCount || 0}/{group.totalMembers || 0} Members
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="list-card-right">
                                        {group.hasRequestedToJoin ? (
                                            <button className="elder-btn-success" disabled>
                                                <CheckCircle size={20} /> Requested
                                            </button>
                                        ) : (
                                            <button
                                                className="elder-btn-primary"
                                                onClick={() => setConfirmGroup(group)}
                                                disabled={requestingId === group._id}
                                            >
                                                {requestingId === group._id ? 'Sending...' : 'Request to Join'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </main>

            {/* Confirmation Modal Overlay */}
            {confirmGroup && (
                <div className="elder-modal-overlay">
                    <div className="elder-modal-card">
                        <h3>Confirm Join Request</h3>
                        <p>Are you sure you want to send a request to join <strong>{confirmGroup.name}</strong>?</p>
                        <div className="elder-modal-actions">
                            <button className="elder-btn-secondary" onClick={() => setConfirmGroup(null)}>Cancel</button>
                            <button className="elder-btn-primary" onClick={confirmJoinRequest}>Yes, Join Group</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupsMembers;