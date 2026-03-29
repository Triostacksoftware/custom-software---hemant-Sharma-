import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderPlus, IndianRupee, Users, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Groups.css';

const CreateGroup = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        totalMembers: '',
        totalMonths: '',
        monthlyContribution: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Business Logic: totalMembers and totalMonths must be equal in this system
        if (name === 'totalMembers') {
            setFormData({ ...formData, totalMembers: value, totalMonths: value });
        } else if (name === 'totalMonths') {
            setFormData({ ...formData, totalMembers: value, totalMonths: value });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleInitialSubmit = (e) => {
        e.preventDefault();

        // Basic frontend validation before showing confirmation
        if (formData.totalMembers < 2) {
            setError("A group must have at least 2 members.");
            return;
        }
        if (formData.monthlyContribution < 1) {
            setError("Monthly contribution must be greater than zero.");
            return;
        }

        setError('');
        setShowConfirm(true); // Open the confirmation modal instead of submitting directly
    };

    const executeCreateGroup = async () => {
        setShowConfirm(false);
        setLoading(true);
        setError('');

        try {
            const payload = {
                name: formData.name,
                totalMembers: Number(formData.totalMembers),
                totalMonths: Number(formData.totalMonths),
                monthlyContribution: Number(formData.monthlyContribution)
            };
            const response = await adminApi.groups.create(payload);

            if (response.data.success) {
                navigate(`/admin/group/${response.data.groupId}`);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

    return (
        <div className="admin-groups-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/groups')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Create New Group</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="groups-main-content center-form">
                <div className="create-group-card">
                    <div className="create-header">
                        <div className="icon-wrapper icon-navy"><FolderPlus size={32} /></div>
                        <h2>Group Details</h2>
                        <p>Groups are created in DRAFT mode. You must add all members before activation.</p>
                    </div>

                    {error && <div className="error-alert">{error}</div>}

                    <form onSubmit={handleInitialSubmit} className="create-group-form">
                        <div className="form-group">
                            <label>Group Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Diwali Bonanza Fund" required />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label><Users size={16} /> Total Members</label>
                                <input type="number" name="totalMembers" value={formData.totalMembers} onChange={handleChange} min="2" placeholder="e.g. 12" required />
                            </div>
                            <div className="form-group">
                                <label><Calendar size={16} /> Total Months</label>
                                <input type="number" name="totalMonths" value={formData.totalMonths} onChange={handleChange} min="2" placeholder="e.g. 12" required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label><IndianRupee size={16} /> Monthly Contribution per Member</label>
                            <input type="number" name="monthlyContribution" value={formData.monthlyContribution} onChange={handleChange} min="1" placeholder="e.g. 5000" required />
                        </div>

                        <button type="submit" className="elder-btn-primary submit-btn" disabled={loading}>
                            {loading ? 'Processing...' : 'Review & Create Group'}
                        </button>
                    </form>
                </div>
            </main>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="elder-modal-overlay">
                    <div className="elder-modal-card">
                        <div className="modal-icon bg-blue-light">
                            <FolderPlus size={32} color="#2563eb" />
                        </div>
                        <h3>Confirm Group Details</h3>
                        <p style={{ marginBottom: '1rem' }}>Please verify the details below before creating this group.</p>

                        <div className="group-confirm-details">
                            <div className="confirm-row">
                                <span>Name:</span>
                                <strong>{formData.name}</strong>
                            </div>
                            <div className="confirm-row">
                                <span>Members / Months:</span>
                                <strong>{formData.totalMembers}</strong>
                            </div>
                            <div className="confirm-row">
                                <span>Monthly Contribution:</span>
                                <strong>{formatCurrency(formData.monthlyContribution)}</strong>
                            </div>
                            <div className="confirm-row highlight-row">
                                <span>Total Group Pool:</span>
                                <strong>{formatCurrency(formData.monthlyContribution * formData.totalMembers)} / mo</strong>
                            </div>
                        </div>

                        <div className="elder-modal-actions mt-1">
                            <button className="elder-btn-secondary" onClick={() => setShowConfirm(false)}>Edit Details</button>
                            <button className="elder-btn-success-solid" onClick={executeCreateGroup}>
                                <CheckCircle size={18} /> Create Group
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateGroup;