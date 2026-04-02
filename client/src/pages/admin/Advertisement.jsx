import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Megaphone, PlusCircle, Edit2, Trash2, Power, PowerOff, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Advertisement.css';

const Advertisement = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ads, setAds] = useState([]);

    // Create/Edit Modal State
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingAdId, setEditingAdId] = useState(null);
    const [formData, setFormData] = useState({ adText: '', adLink: '', isActive: false });
    const [formLoading, setFormLoading] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        show: false, actionType: '', adId: null, title: '', message: '', btnClass: ''
    });

    const fetchAds = async () => {
        setLoading(true);
        try {
            const response = await adminApi.ads.fetchAll();
            if (response.data.success) {
                setAds(response.data.data.ads);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load advertisements.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAds();
    }, []);

    // --- Form Handlers ---
    const openCreateForm = () => {
        setEditingAdId(null);
        setFormData({ adText: '', adLink: '', isActive: false });
        setShowFormModal(true);
    };

    const openEditForm = (ad) => {
        setEditingAdId(ad._id);
        setFormData({ adText: ad.adText, adLink: ad.adLink, isActive: ad.isActive });
        setShowFormModal(true);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            if (editingAdId) {
                await adminApi.ads.update(editingAdId, { adText: formData.adText, adLink: formData.adLink });
            } else {
                await adminApi.ads.create(formData);
            }
            setShowFormModal(false);
            fetchAds();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save advertisement');
        } finally {
            setFormLoading(false);
        }
    };

    // --- Confirmation Handlers ---
    const triggerConfirm = (adId, actionType) => {
        let title, message, btnClass;

        if (actionType === 'activate') {
            title = 'Activate Advertisement';
            message = 'Are you sure you want to broadcast this ad? It will immediately replace the currently active ad on the member dashboard.';
            btnClass = 'elder-btn-success-solid';
        } else if (actionType === 'deactivate') {
            title = 'Deactivate Advertisement';
            message = 'Are you sure you want to stop broadcasting this ad? The marquee on the member dashboard will be hidden.';
            btnClass = 'elder-btn-warning-solid';
        } else if (actionType === 'delete') {
            title = 'Delete Advertisement';
            message = 'Are you sure you want to permanently delete this ad? This action cannot be undone.';
            btnClass = 'elder-btn-danger-solid';
        }

        setConfirmModal({ show: true, actionType, adId, title, message, btnClass });
    };

    const executeAction = async () => {
        const { adId, actionType } = confirmModal;
        setConfirmModal({ show: false, actionType: '', adId: null, title: '', message: '', btnClass: '' });

        try {
            if (actionType === 'activate') await adminApi.ads.activate(adId);
            else if (actionType === 'deactivate') await adminApi.ads.deactivate(adId);
            else if (actionType === 'delete') await adminApi.ads.delete(adId);

            fetchAds();
        } catch (err) {
            alert(err.response?.data?.message || `Failed to ${actionType} ad.`);
        }
    };

    return (
        <div className="admin-ads-container">
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Advertisement Control</h1>
                </div>
                <div className="header-right">
                    <button className="elder-btn-primary" onClick={openCreateForm}>
                        <PlusCircle size={20} /> Create Ad
                    </button>
                </div>
            </header>

            <main className="ads-main-content">
                <div className="section-header-flex">
                    <h2 className="elder-section-title">All Advertisements</h2>
                    <span className="total-count-badge">{ads.length} Total</span>
                </div>

                {loading ? (
                    <div className="elder-empty-card"><div className="spinner"></div><p>Loading advertisements...</p></div>
                ) : error ? (
                    <div className="elder-empty-card"><p className="error-text">{error}</p><button className="elder-btn-primary" onClick={fetchAds}>Retry</button></div>
                ) : ads.length === 0 ? (
                    <div className="elder-empty-card">
                        <div className="empty-icon-wrapper bg-slate-light"><Megaphone size={48} opacity={0.5} /></div>
                        <h3>No Ads Found</h3>
                        <p>Create an advertisement to start broadcasting to members.</p>
                        <button className="elder-btn-primary mt-1" onClick={openCreateForm}>Create First Ad</button>
                    </div>
                ) : (
                    <div className="ads-grid">
                        {ads.map(ad => (
                            <div key={ad._id} className={`ad-card ${ad.isActive ? 'active-ad-card' : ''}`}>
                                {ad.isActive && <div className="live-badge"><span className="pulse-dot"></span> LIVE</div>}

                                <div className="ad-card-content">
                                    <div className="ad-icon-wrapper bg-slate-light">
                                        <Megaphone size={24} className={ad.isActive ? 'text-green' : 'text-slate'} />
                                    </div>
                                    <div className="ad-details">
                                        <h3 className="ad-text-preview">"{ad.adText}"</h3>
                                        <a href={ad.adLink} target="_blank" rel="noreferrer" className="ad-link-preview">
                                            <ExternalLink size={14} /> {ad.adLink}
                                        </a>
                                        <p className="ad-date">Last Updated: {new Date(ad.updatedAt).toLocaleDateString('en-IN')}</p>
                                    </div>
                                </div>

                                <div className="ad-card-actions">
                                    <button className="icon-action-btn edit" onClick={() => openEditForm(ad)} title="Edit Ad">
                                        <Edit2 size={18} />
                                    </button>

                                    {ad.isActive ? (
                                        <button className="icon-action-btn deactivate" onClick={() => triggerConfirm(ad._id, 'deactivate')} title="Stop Broadcasting">
                                            <PowerOff size={18} />
                                        </button>
                                    ) : (
                                        <button className="icon-action-btn activate" onClick={() => triggerConfirm(ad._id, 'activate')} title="Broadcast Ad">
                                            <Power size={18} />
                                        </button>
                                    )}

                                    <button className="icon-action-btn delete" onClick={() => triggerConfirm(ad._id, 'delete')} title="Delete Ad">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create/Edit Form Modal */}
            {showFormModal && (
                <div className="elder-modal-overlay">
                    <div className="elder-modal-card form-modal">
                        <h3>{editingAdId ? 'Edit Advertisement' : 'Create Advertisement'}</h3>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                            {editingAdId ? 'Update the text or link of this ad.' : 'Create a new scrolling message for the member dashboard.'}
                        </p>

                        <form onSubmit={handleFormSubmit} className="create-group-form">
                            <div className="form-group">
                                <label>Broadcast Message</label>
                                <textarea
                                    name="adText"
                                    value={formData.adText}
                                    onChange={handleFormChange}
                                    placeholder="e.g. Join our new Diwali Bonanza group! 50% off first month..."
                                    rows="3"
                                    required
                                    className="admin-textarea"
                                />
                            </div>

                            <div className="form-group">
                                <label>Redirection Link</label>
                                <input
                                    type="url"
                                    name="adLink"
                                    value={formData.adLink}
                                    onChange={handleFormChange}
                                    placeholder="e.g. https://kamautipro.com/register"
                                    required
                                />
                            </div>

                            {!editingAdId && (
                                <div className="form-group toggle-group">
                                    <label className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            name="isActive"
                                            checked={formData.isActive}
                                            onChange={handleFormChange}
                                        />
                                        <span className="checkmark"></span>
                                        <strong>Set as Active immediately</strong>
                                    </label>
                                    <p className="toggle-hint">This will deactivate any currently running ad.</p>
                                </div>
                            )}

                            <div className="elder-modal-actions mt-1">
                                <button type="button" className="elder-btn-secondary" onClick={() => setShowFormModal(false)}>Cancel</button>
                                <button type="submit" className="elder-btn-primary" disabled={formLoading}>
                                    {formLoading ? 'Saving...' : 'Save Advertisement'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* General Action Confirmation Modal */}
            {confirmModal.show && (
                <div className="elder-modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="elder-modal-card confirm-modal-card">
                        <div className={`modal-icon ${confirmModal.actionType === 'delete' ? 'bg-red-light' : confirmModal.actionType === 'deactivate' ? 'bg-yellow-light' : 'bg-green-light'}`}>
                            {confirmModal.actionType === 'delete' ? <Trash2 size={32} color="#dc2626" /> : confirmModal.actionType === 'deactivate' ? <PowerOff size={32} color="#d97706" /> : <CheckCircle size={32} color="#15803d" />}
                        </div>
                        <h3>{confirmModal.title}</h3>
                        <p style={{ marginBottom: '1.5rem' }}>{confirmModal.message}</p>

                        <div className="elder-modal-actions">
                            <button className="elder-btn-secondary" onClick={() => setConfirmModal({ show: false })}>Cancel</button>
                            <button className={confirmModal.btnClass} onClick={executeAction}>
                                Confirm Action
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Advertisement;