import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Search, User, Briefcase, ChevronLeft, ChevronRight, AlertTriangle, CheckSquare } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Approvals.css';

const Approvals = () => {
    const navigate = useNavigate();

    // States
    const [activeTab, setActiveTab] = useState('members'); // 'members' or 'employees'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dataList, setDataList] = useState([]);

    // Pagination & Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

    // Action States
    const [processingId, setProcessingId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ show: false, id: null, actionType: '', name: '' });

    // Fetch Data Function
    const fetchData = useCallback(async (page = 1, search = '') => {
        setLoading(true);
        setError('');

        try {
            let response;
            if (activeTab === 'members') {
                response = await adminApi.users.listPending({ page, limit: 10, search });
                if (response.data.success) {
                    setDataList(response.data.data.users);
                    setPagination(response.data.data.pagination);
                }
            } else {
                response = await adminApi.employees.listPending({ page, limit: 10, search });
                if (response.data.success) {
                    setDataList(response.data.data.employees);
                    setPagination(response.data.data.pagination);
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load pending approvals.');
            setDataList([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    // Initial Fetch & on Tab Change
    useEffect(() => {
        fetchData(1, searchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Search Handler
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchData(1, searchQuery);
    };

    // Pagination Handler
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchData(newPage, searchQuery);
        }
    };

    // Modal Handlers
    const openConfirmModal = (id, actionType, name) => {
        setConfirmModal({ show: true, id, actionType, name });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ show: false, id: null, actionType: '', name: '' });
    };

    const executeAction = async () => {
        const { id, actionType } = confirmModal;
        closeConfirmModal();
        setProcessingId(id);

        try {
            let response;
            if (activeTab === 'members') {
                response = actionType === 'approve'
                    ? await adminApi.users.approve(id)
                    : await adminApi.users.reject(id);
            } else {
                response = actionType === 'approve'
                    ? await adminApi.employees.approve(id)
                    : await adminApi.employees.reject(id);
            }

            if (response.data.success) {
                // Remove the item from the list instantly
                setDataList(prev => prev.filter(item => item._id !== id));
                // Update total count
                setPagination(prev => ({ ...prev, total: prev.total - 1 }));
            }
        } catch (err) {
            alert(err.response?.data?.message || `Failed to ${actionType}. Please try again.`);
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    };

    return (
        <div className="admin-approvals-container">
            {/* Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Pending Approvals</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="approvals-main-content">

                {/* Tabs & Search Bar */}
                <div className="approvals-control-panel">
                    <div className="approvals-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('members'); setSearchQuery(''); }}
                        >
                            <User size={18} /> Pending Members
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('employees'); setSearchQuery(''); }}
                        >
                            <Briefcase size={18} /> Pending Employees
                        </button>
                    </div>

                    <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                        <div className="admin-search-input-wrapper">
                            <Search size={20} className="admin-search-icon" />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                className="admin-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="admin-search-submit-btn">Search</button>
                    </form>
                </div>

                {/* List Container */}
                <section className="elder-section">
                    <div className="section-header-flex">
                        <h2 className="elder-section-title">
                            {activeTab === 'members' ? 'Member Registrations' : 'Employee Registrations'}
                        </h2>
                        <span className="total-count-badge">{pagination.total} Total Pending</span>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card">
                            <div className="spinner"></div>
                            <p className="loading-text">Loading pending approvals...</p>
                        </div>
                    ) : error ? (
                        <div className="elder-empty-card">
                            <p className="error-text">{error}</p>
                            <button className="elder-btn-primary" onClick={() => fetchData(pagination.currentPage, searchQuery)}>Retry</button>
                        </div>
                    ) : dataList.length === 0 ? (
                        <div className="elder-empty-card">
                            <div className="empty-icon-wrapper icon-slate">
                                <CheckSquare size={48} opacity={0.5} />
                            </div>
                            <p>No pending approvals found.</p>
                            {searchQuery && <p className="sub-empty-text">Try clearing your search filter.</p>}
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {dataList.map((person) => (
                                <div key={person._id} className="elder-list-card approval-card">
                                    <div className="list-card-left">
                                        <div className={`icon-wrapper ${activeTab === 'members' ? 'icon-slate' : 'icon-navy'}`}>
                                            {activeTab === 'members' ? <User size={28} /> : <Briefcase size={28} />}
                                        </div>
                                        <div className="list-card-info">
                                            <h3 className="elder-card-title">{person.name}</h3>
                                            <div className="person-details-inline">
                                                <span className="detail-text">{person.phoneNumber || person.phone || 'No phone number'}</span>
                                            </div>
                                            <div className="meta-info">
                                                <span>Registered: {formatDate(person.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="list-card-right approval-actions">
                                        <button
                                            className="elder-btn-danger-outline"
                                            disabled={processingId === person._id}
                                            onClick={() => openConfirmModal(person._id, 'reject', person.name)}
                                        >
                                            {processingId === person._id ? '...' : <><X size={18} /> Reject</>}
                                        </button>
                                        <button
                                            className="elder-btn-success-solid"
                                            disabled={processingId === person._id}
                                            onClick={() => openConfirmModal(person._id, 'approve', person.name)}
                                        >
                                            {processingId === person._id ? 'Processing...' : <><Check size={18} /> Approve</>}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Pagination Controls */}
                {!loading && dataList.length > 0 && pagination.totalPages > 1 && (
                    <div className="elder-pagination">
                        <button
                            className="page-btn"
                            disabled={pagination.currentPage === 1}
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                        >
                            <ChevronLeft size={24} /> Prev
                        </button>
                        <span className="page-info">
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                        <button
                            className="page-btn"
                            disabled={pagination.currentPage === pagination.totalPages}
                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                        >
                            Next <ChevronRight size={24} />
                        </button>
                    </div>
                )}

            </main>

            {/* Confirmation Modal Overlay */}
            {confirmModal.show && (
                <div className="elder-modal-overlay">
                    <div className="elder-modal-card">
                        <div className={`modal-icon ${confirmModal.actionType === 'approve' ? 'bg-green-light' : 'bg-red-light'}`}>
                            {confirmModal.actionType === 'approve' ? <Check size={32} color="#15803d" /> : <AlertTriangle size={32} color="#b91c1c" />}
                        </div>
                        <h3>Confirm {confirmModal.actionType === 'approve' ? 'Approval' : 'Rejection'}</h3>
                        <p>
                            Are you sure you want to <strong>{confirmModal.actionType}</strong> the registration for <strong>{confirmModal.name}</strong>?
                            {confirmModal.actionType === 'reject' && ' They will not be able to log in to the platform.'}
                        </p>
                        <div className="elder-modal-actions">
                            <button className="elder-btn-secondary" onClick={closeConfirmModal}>Cancel</button>
                            <button
                                className={confirmModal.actionType === 'approve' ? 'elder-btn-success-solid' : 'elder-btn-danger-solid'}
                                onClick={executeAction}
                            >
                                Yes, {confirmModal.actionType}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Approvals;