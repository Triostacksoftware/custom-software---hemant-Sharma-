import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Briefcase, ChevronLeft, ChevronRight, ArrowRight, X, ArrowUpRight, ArrowDownLeft, CalendarClock } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import './Employees.css';

const Employees = () => {
    const navigate = useNavigate();

    // Main Directory States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

    // Slide-out History Panel States
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyPagination, setHistoryPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });

    // Fetch Employees List (Default to Approved employees only)
    const fetchEmployees = useCallback(async (page = 1, search = '') => {
        setLoading(true);
        setError('');
        try {
            const response = await adminApi.employees.fetchAll({ page, limit: 10, search, approvalStatus: 'APPROVED' });
            if (response.data.success) {
                setEmployees(response.data.data.employees);
                setPagination(response.data.data.pagination);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load employees.');
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmployees(1, searchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchEmployees(1, searchQuery);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchEmployees(newPage, searchQuery);
        }
    };

    // Fetch Specific Employee History
    const fetchEmployeeHistory = async (employeeId, page = 1) => {
        setHistoryLoading(true);
        try {
            const response = await adminApi.employees.getHistory(employeeId, { page, limit: 10 });
            if (response.data.success) {
                setHistoryData(response.data.data.transactions);
                setHistoryPagination(response.data.data.pagination);

                // If it's the first page load, set the employee data to open the panel
                if (page === 1) {
                    setSelectedEmployee(response.data.data.employee);
                }
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to load employee history.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const closeHistoryPanel = () => {
        setSelectedEmployee(null);
        setHistoryData([]);
    };

    const handleHistoryPageChange = (newPage) => {
        if (newPage >= 1 && newPage <= historyPagination.totalPages) {
            fetchEmployeeHistory(selectedEmployee._id, newPage);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(amount);
    };

    const formatDateTime = (dateString) => {
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="admin-employees-container">
            {/* Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/admin/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Employee Directory</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="employees-main-content">

                {/* Search Bar */}
                <div className="employees-control-panel">
                    <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                        <div className="admin-search-input-wrapper">
                            <Search size={20} className="admin-search-icon" />
                            <input
                                type="text"
                                placeholder="Search by name or phone number..."
                                className="admin-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="admin-search-submit-btn">Search</button>
                    </form>
                </div>

                {/* Employees List */}
                <section className="elder-section">
                    <div className="section-header-flex">
                        <h2 className="elder-section-title">Active Personnel</h2>
                        <span className="total-count-badge">{pagination.total} Total</span>
                    </div>

                    {loading ? (
                        <div className="elder-empty-card">
                            <div className="spinner"></div>
                            <p className="loading-text">Loading directory...</p>
                        </div>
                    ) : error ? (
                        <div className="elder-empty-card">
                            <p className="error-text">{error}</p>
                            <button className="elder-btn-primary" onClick={() => fetchEmployees(pagination.currentPage, searchQuery)}>Retry</button>
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="elder-empty-card">
                            <div className="empty-icon-wrapper icon-slate">
                                <Briefcase size={48} opacity={0.5} />
                            </div>
                            <p>No active employees found.</p>
                            {searchQuery && <p className="sub-empty-text">Try clearing your search filter.</p>}
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {employees.map((emp) => (
                                <div
                                    key={emp._id}
                                    className="elder-list-card clickable-card"
                                    onClick={() => fetchEmployeeHistory(emp._id, 1)}
                                >
                                    <div className="list-card-left">
                                        <div className="icon-wrapper icon-navy">
                                            <Briefcase size={26} />
                                        </div>
                                        <div className="list-card-info">
                                            <div className="title-with-role">
                                                <h3 className="elder-card-title">{emp.name}</h3>
                                                <span className={`role-badge ${emp.role === 'ADMIN' ? 'badge-admin' : 'badge-emp'}`}>
                                                    {emp.role === 'ADMIN' ? 'Admin' : 'Employee'}
                                                </span>
                                            </div>
                                            <div className="person-details-inline">
                                                <span className="detail-text">{emp.phoneNumber}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="list-card-right">
                                        <button className="view-history-btn">
                                            View History <ArrowRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Main Pagination */}
                {!loading && employees.length > 0 && pagination.totalPages > 1 && (
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

            {/* Slide-out History Panel Overlay */}
            {selectedEmployee && (
                <>
                    <div className="history-panel-overlay" onClick={closeHistoryPanel}></div>
                    <div className="history-slide-panel">
                        <div className="history-panel-header">
                            <div className="panel-header-info">
                                <div className="title-with-role">
                                    <h2>{selectedEmployee.name}</h2>
                                    <span className={`role-badge ${selectedEmployee.role === 'ADMIN' ? 'badge-admin' : 'badge-emp'}`}>
                                        {selectedEmployee.role === 'ADMIN' ? 'Admin' : 'Employee'}
                                    </span>
                                </div>
                                <p>{selectedEmployee.phoneNumber}</p>
                            </div>
                            <button className="panel-close-btn" onClick={closeHistoryPanel}>
                                <X size={28} />
                            </button>
                        </div>

                        <div className="history-panel-body">
                            <h3 className="history-section-title">Activity Log</h3>

                            {historyLoading ? (
                                <div className="history-empty"><div className="spinner"></div></div>
                            ) : historyData.length === 0 ? (
                                <div className="history-empty">
                                    <CalendarClock size={40} opacity={0.3} />
                                    <p>No transactions logged by this user yet.</p>
                                </div>
                            ) : (
                                <div className="history-list">
                                    {historyData.map((tx) => {
                                        const isContribution = tx.type === 'CONTRIBUTION';
                                        return (
                                            <div key={tx._id} className="history-tx-card">
                                                <div className="history-tx-header">
                                                    <div className={`history-tx-icon ${isContribution ? 'bg-blue-light' : 'bg-green-light'}`}>
                                                        {isContribution ? <ArrowUpRight size={20} color="#2563eb" /> : <ArrowDownLeft size={20} color="#059669" />}
                                                    </div>
                                                    <div className="history-tx-main">
                                                        <h4>{isContribution ? 'Collected Contribution' : 'Distributed Payout'}</h4>
                                                        <span className="tx-date">{formatDateTime(tx.handledAt)}</span>
                                                    </div>
                                                    <div className={`history-tx-amount ${isContribution ? 'text-blue' : 'text-green'}`}>
                                                        {formatCurrency(tx.amount)}
                                                    </div>
                                                </div>

                                                <div className="history-tx-details">
                                                    <p><strong>Group:</strong> {tx.group?.name || 'N/A'}</p>
                                                    <p><strong>Member:</strong> {tx.member?.name || 'N/A'} ({tx.member?.phoneNumber})</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* History Pagination */}
                            {!historyLoading && historyData.length > 0 && historyPagination.totalPages > 1 && (
                                <div className="history-pagination">
                                    <button
                                        className="page-btn"
                                        disabled={historyPagination.currentPage === 1}
                                        onClick={() => handleHistoryPageChange(historyPagination.currentPage - 1)}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span>{historyPagination.currentPage} / {historyPagination.totalPages}</span>
                                    <button
                                        className="page-btn"
                                        disabled={historyPagination.currentPage === historyPagination.totalPages}
                                        onClick={() => handleHistoryPageChange(historyPagination.currentPage + 1)}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Employees;