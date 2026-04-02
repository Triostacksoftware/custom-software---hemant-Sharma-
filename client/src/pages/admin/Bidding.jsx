import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, Search, PlayCircle, Users, Activity, CheckCircle, TrendingDown, ArrowRight } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Bidding.css';

const BiddingHub = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [groups, setGroups] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchActiveGroups = async () => {
        setLoading(true);
        try {
            // Fetch all active groups (limit 100 to ensure we get them all for the hub)
            const response = await adminApi.groups.fetchAll({ status: 'ACTIVE', limit: 100 });
            if (response.data.success) {
                setGroups(response.data.data.groups);
            }
        } catch (err) {
            setError('Failed to load active groups.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveGroups();
    }, []);

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

    return (
        <div className="admin-bidding-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Bidding Control Hub</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="bidding-main-content">

                {/* Fixed the missing margin and added styling to the control panel */}
                <div className="bidding-control-panel">
                    <div className="admin-search-input-wrapper" style={{ maxWidth: '450px', width: '100%' }}>
                        <Search size={20} className="admin-search-icon" />
                        <input
                            type="text"
                            placeholder="Search active groups..."
                            className="admin-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <section className="elder-section">
                    <div className="section-header-flex">
                        <h2 className="elder-section-title">Active Bidding Groups</h2>
                        <span className="total-count-badge">{filteredGroups.length} Active</span>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card"><div className="spinner"></div><p>Loading groups...</p></div>
                    ) : error ? (
                        <div className="elder-empty-card"><p className="error-text">{error}</p></div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="elder-empty-card">
                            <div className="empty-icon-wrapper bg-indigo-light">
                                <Gavel size={48} className="text-indigo" opacity={0.6} />
                            </div>
                            <p>No active groups found for bidding.</p>
                        </div>
                    ) : (
                        <div className="bidding-grid">
                            {filteredGroups.map(group => (
                                <div key={group._id} className="bidding-card" onClick={() => navigate(`/admin/bidding/room/${group._id}`)}>

                                    <div className="bcard-header">
                                        <div className="bcard-title-wrapper">
                                            <div className="bcard-icon bg-indigo-light text-indigo">
                                                <Gavel size={22} />
                                            </div>
                                            <h3>{group.name}</h3>
                                        </div>
                                        <span className="month-pill bg-blue-light text-blue border-blue">Month {group.currentMonth}</span>
                                    </div>

                                    <div className="bcard-stats">
                                        <div className="bstat">
                                            <span>Pool Size</span>
                                            <strong>{formatCurrency(group.monthlyContribution * group.totalMembers)}</strong>
                                        </div>
                                        <div className="bstat">
                                            <span>Members</span>
                                            <strong><Users size={14} className="text-slate" /> {group.memberCount}</strong>
                                        </div>
                                    </div>

                                    <div className="bcard-footer">
                                        {group.currentMonth === 1 ? (
                                            <div className="status-indicator admin-round-indicator">
                                                <CheckCircle size={18} /> Admin Round (No Bidding)
                                            </div>
                                        ) : (
                                            <button className="enter-room-btn">
                                                Enter Control Room <ArrowRight size={18} />
                                            </button>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default BiddingHub;