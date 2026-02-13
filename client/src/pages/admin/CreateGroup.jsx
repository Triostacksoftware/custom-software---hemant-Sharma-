import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { ArrowLeft, Loader, CheckCircle } from 'lucide-react';
import './CreateGroup.css';

const CreateGroup = () => {
    const navigate = useNavigate();

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        totalMembers: '',
        totalMonths: '',
        monthlyContribution: '',
    });

    // UI states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(''); // <-- success message
    const [validationErrors, setValidationErrors] = useState({});

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear field-specific error when user types
        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: '' }));
        }
        // Clear general error
        if (error) setError('');
        if (success) setSuccess(''); // clear success on new input
    };

    // Client-side validation
    const validateForm = () => {
        const errors = {};

        if (!formData.name.trim()) {
            errors.name = 'Group name is required';
        }

        if (!formData.totalMembers) {
            errors.totalMembers = 'Total members is required';
        } else {
            const members = Number(formData.totalMembers);
            if (members < 2) {
                errors.totalMembers = 'Minimum 2 members required';
            }
        }

        if (!formData.totalMonths) {
            errors.totalMonths = 'Total months is required';
        } else {
            const months = Number(formData.totalMonths);
            if (months < 1) {
                errors.totalMonths = 'Must be at least 1 month';
            }
        }

        if (!formData.monthlyContribution) {
            errors.monthlyContribution = 'Monthly contribution is required';
        } else {
            const amount = Number(formData.monthlyContribution);
            if (amount <= 0) {
                errors.monthlyContribution = 'Must be greater than zero';
            }
        }

        // Business rule: totalMembers must equal totalMonths
        const members = Number(formData.totalMembers);
        const months = Number(formData.totalMonths);
        if (members && months && members !== months) {
            errors.generalMatch = 'Total members must equal total months';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                name: formData.name.trim(),
                totalMembers: Number(formData.totalMembers),
                totalMonths: Number(formData.totalMonths),
                monthlyContribution: Number(formData.monthlyContribution),
            };

            const response = await adminApi.groups.create(payload);

            // Success! Show message and redirect to groups list
            setSuccess('Group created successfully! Redirecting to groups list...');

            // Clear form
            setFormData({
                name: '',
                totalMembers: '',
                totalMonths: '',
                monthlyContribution: '',
            });

            // Redirect after 1.5 seconds
            setTimeout(() => {
                navigate('/admin/groups');
            }, 1500);

        } catch (err) {
            // Handle API error
            const apiError = err.response?.data?.message || 'Failed to create group. Please try again.';
            setError(apiError);

            // If it's an auth error (401/403), the global interceptor will logout.
            // We still show the error message before that happens.
            if (err.response?.status === 401 || err.response?.status === 403) {
                setError('Authentication error. Please login again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-group-page">
            <div className="create-group-header">
                <button className="back-btn" onClick={() => navigate('/admin/groups')}>
                    <ArrowLeft size={18} />
                    Back to Groups
                </button>
                <h1 className="page-title">Create New Group</h1>
                <p className="page-subtitle">Set up a new chit fund group</p>
            </div>

            <div className="form-container">
                {/* Success Message */}
                {success && (
                    <div className="form-success">
                        <CheckCircle size={18} />
                        <span>{success}</span>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="form-error">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="create-group-form">
                    {/* Group Name */}
                    <div className="form-group">
                        <label htmlFor="name">
                            Group Name <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g., Family Savings Fund"
                            className={validationErrors.name ? 'error' : ''}
                            disabled={loading || success} // disable during success too
                        />
                        {validationErrors.name && (
                            <span className="error-message">{validationErrors.name}</span>
                        )}
                    </div>

                    {/* Total Members & Total Months – side by side */}
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="totalMembers">
                                Total Members <span className="required">*</span>
                            </label>
                            <input
                                type="number"
                                id="totalMembers"
                                name="totalMembers"
                                value={formData.totalMembers}
                                onChange={handleChange}
                                placeholder="e.g., 10"
                                min="2"
                                className={validationErrors.totalMembers ? 'error' : ''}
                                disabled={loading || success}
                            />
                            {validationErrors.totalMembers && (
                                <span className="error-message">{validationErrors.totalMembers}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="totalMonths">
                                Total Months <span className="required">*</span>
                            </label>
                            <input
                                type="number"
                                id="totalMonths"
                                name="totalMonths"
                                value={formData.totalMonths}
                                onChange={handleChange}
                                placeholder="e.g., 10"
                                min="1"
                                className={validationErrors.totalMonths ? 'error' : ''}
                                disabled={loading || success}
                            />
                            {validationErrors.totalMonths && (
                                <span className="error-message">{validationErrors.totalMonths}</span>
                            )}
                        </div>
                    </div>

                    {/* Match validation message (displayed between fields) */}
                    {validationErrors.generalMatch && (
                        <div className="match-error">
                            {validationErrors.generalMatch}
                        </div>
                    )}

                    {/* Monthly Contribution */}
                    <div className="form-group">
                        <label htmlFor="monthlyContribution">
                            Monthly Contribution (₹) <span className="required">*</span>
                        </label>
                        <input
                            type="number"
                            id="monthlyContribution"
                            name="monthlyContribution"
                            value={formData.monthlyContribution}
                            onChange={handleChange}
                            placeholder="e.g., 1000"
                            min="1"
                            step="1"
                            className={validationErrors.monthlyContribution ? 'error' : ''}
                            disabled={loading || success}
                        />
                        {validationErrors.monthlyContribution && (
                            <span className="error-message">{validationErrors.monthlyContribution}</span>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={() => navigate('/admin/groups')}
                            disabled={loading || success}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={loading || success}
                        >
                            {loading ? (
                                <>
                                    <Loader size={18} className="spinner" />
                                    Creating...
                                </>
                            ) : success ? (
                                <>
                                    <CheckCircle size={18} />
                                    Created!
                                </>
                            ) : (
                                'Create Group'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGroup;