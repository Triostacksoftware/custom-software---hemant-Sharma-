import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, IndianRupee, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { userApi } from '../../api/userApi';
import './Transactions.css';

const Transactions = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Data States
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

    // Filter State (null = All, 'CONTRIBUTION' = Paid, 'WINNER_PAYOUT' = Received)
    const [filterType, setFilterType] = useState(null);

    useEffect(() => {
        fetchTransactions(1, filterType);
    }, [filterType]);

    const fetchTransactions = async (pageToFetch, typeFilter) => {
        try {
            setLoading(true);

            // FIX: Package arguments into a proper object for the updated API
            const params = {
                page: pageToFetch,
                limit: 10
            };
            if (typeFilter) {
                params.type = typeFilter;
            }

            const response = await userApi.getTransactionHistory(params);

            if (response.data.success) {
                setTransactions(response.data.data.transactions);
                setPagination(response.data.data.pagination);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to load passbook');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (type) => {
        setFilterType(type);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchTransactions(newPage, filterType);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDateTime = (dateString) => {
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusText = (status) => {
        if (status === 'USER_CONFIRMED') return 'Processing';
        return status;
    };

    return (
        <div className="elder-transactions-container">
            {/* Unified Header */}
            <header className="dashboard-header groups-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/user/dashboard')}>
                        <ArrowLeft size={24} />
                        <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Passbook</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="transactions-main-content">

                {/* Large, Tap-Friendly Filters */}
                <div className="filter-buttons-container">
                    <button
                        className={`filter-btn ${filterType === null ? 'active' : ''}`}
                        onClick={() => handleFilterChange(null)}
                    >
                        All History
                    </button>
                    <button
                        className={`filter-btn ${filterType === 'CONTRIBUTION' ? 'active-paid' : ''}`}
                        onClick={() => handleFilterChange('CONTRIBUTION')}
                    >
                        Paid by Me
                    </button>
                    <button
                        className={`filter-btn ${filterType === 'WINNER_PAYOUT' ? 'active-received' : ''}`}
                        onClick={() => handleFilterChange('WINNER_PAYOUT')}
                    >
                        Received
                    </button>
                </div>

                {/* Main List Container */}
                <section className="elder-section">
                    {loading ? (
                        <div className="elder-empty-card">
                            <div className="spinner"></div>
                            <p className="loading-text">Loading passbook...</p>
                        </div>
                    ) : error ? (
                        <div className="elder-empty-card">
                            <p className="error-text">{error}</p>
                            <button className="elder-btn-primary" onClick={() => fetchTransactions(1, filterType)}>Try Again</button>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="elder-empty-card">
                            <p>No transactions found for this category.</p>
                        </div>
                    ) : (
                        <div className="elder-list-container">
                            {transactions.map((tx) => {
                                const isContribution = tx.type === 'CONTRIBUTION';

                                return (
                                    <div key={tx._id} className="elder-list-card tx-card">

                                        <div className="list-card-left">
                                            {/* Icon matches the type of transaction */}
                                            <div className={`icon-wrapper ${isContribution ? 'blue-icon' : 'green-icon'}`}>
                                                {isContribution ? <ArrowUpRight size={28} /> : <ArrowDownLeft size={28} />}
                                            </div>

                                            <div className="list-card-info">
                                                <h3 className="elder-card-title">
                                                    {isContribution ? 'Contribution Paid' : 'Winning Amount Received'}
                                                </h3>
                                                <div className="tx-details-inline">
                                                    <span className="tx-detail-text font-semibold">{tx.group?.name || 'Unknown Group'}</span>
                                                    <span className="stat-divider">•</span>
                                                    <span className="tx-detail-text">Month {tx.monthNumber}</span>
                                                </div>
                                                <div className="tx-meta-info">
                                                    <span>{formatDateTime(tx.createdAt)}</span>
                                                    {tx.handledBy && (
                                                        <>
                                                            <span className="stat-divider">•</span>
                                                            <span className="handled-by">
                                                                <User size={14} /> {tx.handledBy.name}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="list-card-right tx-amount-section">
                                            <span className={`tx-amount ${isContribution ? 'text-blue' : 'text-green'}`}>
                                                {isContribution ? '-' : '+'}<IndianRupee size={20} className="rupee-inline" />{formatCurrency(tx.amount).replace('₹', '').trim()}
                                            </span>

                                            <span className={`status-badge ${tx.status === 'COMPLETED' ? 'badge-success' : tx.status === 'CANCELLED' ? 'badge-error' : 'badge-warning'}`}>
                                                {getStatusText(tx.status)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Pagination Controls */}
                {!loading && transactions.length > 0 && (
                    <div className="elder-pagination">
                        <button
                            className="page-btn"
                            disabled={pagination.page === 1}
                            onClick={() => handlePageChange(pagination.page - 1)}
                        >
                            <ChevronLeft size={24} /> Previous
                        </button>
                        <span className="page-info">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                            className="page-btn"
                            disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                            onClick={() => handlePageChange(pagination.page + 1)}
                        >
                            Next <ChevronRight size={24} />
                        </button>
                    </div>
                )}

            </main>
        </div>
    );
};

export default Transactions;