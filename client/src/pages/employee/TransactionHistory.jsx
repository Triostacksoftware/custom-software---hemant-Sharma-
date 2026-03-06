import React, { useState, useEffect } from 'react';
import { employeeApi } from '../../api/employeeApi';
import {
    Calendar,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader,
    Search,
    X
} from 'lucide-react';
import './TransactionHistory.css';

const TransactionHistory = () => {
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 20,
        pages: 0,
    });
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({
        groupId: '',
        memberId: '',
        type: '',
        fromDate: '',
        toDate: '',
        page: 1,
        limit: 20,
    });
    const [memberSearch, setMemberSearch] = useState('');
    const [members, setMembers] = useState([]); // will be populated from group selection
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Fetch groups for filter dropdown
    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await employeeApi.getActiveGroups();
            setGroups(response.data.groups || []);
        } catch (err) {
            console.error('Failed to fetch groups:', err);
        }
    };

    // Fetch members when group changes (optional, to filter by member)
    useEffect(() => {
        if (!filters.groupId) {
            setMembers([]);
            setFilters(prev => ({ ...prev, memberId: '' }));
            return;
        }
        const fetchMembers = async () => {
            setLoadingMembers(true);
            try {
                // Use pending members endpoint to get members of that group
                const response = await employeeApi.getPendingTransactions(filters.groupId);
                // Combine both contribution pending and payout pending members
                const pendingContributors = response.data.contributionPendingMembers || [];
                const payout = response.data.payoutPending ? [response.data.payoutPending] : [];
                // Map to simple format
                const allMembers = [
                    ...pendingContributors.map(m => ({ _id: m.userId, name: m.name })),
                    ...payout.map(m => ({ _id: m.userId, name: m.name })),
                ];
                // Remove duplicates (in case winner appears in both, unlikely)
                const unique = Array.from(new Map(allMembers.map(m => [m._id, m])).values());
                setMembers(unique);
            } catch (err) {
                console.error('Failed to fetch members:', err);
                setMembers([]);
            } finally {
                setLoadingMembers(false);
            }
        };
        fetchMembers();
    }, [filters.groupId]);

    // Fetch transaction history whenever filters change (except memberSearch)
    useEffect(() => {
        fetchHistory();
    }, [
        filters.groupId,
        filters.memberId,
        filters.type,
        filters.fromDate,
        filters.toDate,
        filters.page,
        filters.limit,
    ]);

    const fetchHistory = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {
                page: filters.page,
                limit: filters.limit,
                ...(filters.groupId && { groupId: filters.groupId }),
                ...(filters.memberId && { memberId: filters.memberId }),
                ...(filters.type && { type: filters.type }),
                ...(filters.fromDate && { fromDate: filters.fromDate }),
                ...(filters.toDate && { toDate: filters.toDate }),
            };
            const response = await employeeApi.getTransactionHistory(params);
            setTransactions(response.data.data.transactions);
            setPagination(response.data.data.pagination);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load transaction history');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 })); // reset to page 1
    };

    const clearFilters = () => {
        setFilters({
            groupId: '',
            memberId: '',
            type: '',
            fromDate: '',
            toDate: '',
            page: 1,
            limit: 20,
        });
        setMemberSearch('');
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            setFilters(prev => ({ ...prev, page: newPage }));
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase())
    );

    return (
        <div className="history-page">
            <h1 className="page-title">Transaction History</h1>
            <p className="page-subtitle">View all transactions you have logged</p>

            {/* Filters */}
            <div className="filters-card">
                <div className="filters-header">
                    <Filter size={18} />
                    <span>Filters</span>
                    <button className="clear-filters" onClick={clearFilters}>
                        <X size={16} /> Clear
                    </button>
                </div>
                <div className="filters-grid">
                    {/* Group filter */}
                    <div className="filter-group">
                        <label>Group</label>
                        <select
                            value={filters.groupId}
                            onChange={(e) => handleFilterChange('groupId', e.target.value)}
                        >
                            <option value="">All Groups</option>
                            {groups.map(g => (
                                <option key={g._id} value={g._id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Member filter (depends on group) */}
                    <div className="filter-group">
                        <label>Member</label>
                        {filters.groupId ? (
                            <>
                                <div className="member-search-wrapper">
                                    <Search size={14} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search member..."
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                    />
                                </div>
                                <select
                                    value={filters.memberId}
                                    onChange={(e) => handleFilterChange('memberId', e.target.value)}
                                    disabled={loadingMembers}
                                >
                                    <option value="">All Members</option>
                                    {filteredMembers.map(m => (
                                        <option key={m._id} value={m._id}>{m.name}</option>
                                    ))}
                                </select>
                            </>
                        ) : (
                            <select disabled>
                                <option>Select a group first</option>
                            </select>
                        )}
                    </div>

                    {/* Type filter */}
                    <div className="filter-group">
                        <label>Transaction Type</label>
                        <select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        >
                            <option value="">All Types</option>
                            <option value="CONTRIBUTION">Contribution</option>
                            <option value="WINNER_PAYOUT">Winner Payout</option>
                        </select>
                    </div>

                    {/* Date range */}
                    <div className="filter-group">
                        <label>From Date</label>
                        <input
                            type="date"
                            value={filters.fromDate}
                            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                            max={filters.toDate || undefined}
                        />
                    </div>
                    <div className="filter-group">
                        <label>To Date</label>
                        <input
                            type="date"
                            value={filters.toDate}
                            onChange={(e) => handleFilterChange('toDate', e.target.value)}
                            min={filters.fromDate || undefined}
                            max={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="error-message">
                    <strong>Error:</strong> {error}
                    <button onClick={fetchHistory}>Retry</button>
                </div>
            )}

            {/* Transactions Table */}
            <div className="transactions-table-container">
                {loading ? (
                    <div className="loading-container">
                        <Loader size={40} className="spinner" />
                        <p>Loading transactions...</p>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="no-data">No transactions found.</div>
                ) : (
                    <>
                        <table className="transactions-table">
                            <thead>
                                <tr>
                                    <th>Date & Time</th>
                                    <th>Group</th>
                                    <th>Member</th>
                                    <th>Month</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Payment Mode</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => (
                                    <tr key={tx._id}>
                                        <td className="date-cell">{formatDate(tx.handledAt)}</td>
                                        <td>{tx.groupId?.name || '—'}</td>
                                        <td>{tx.userId?.name || '—'}</td>
                                        <td className="month-cell">Month {tx.monthNumber}</td>
                                        <td>
                                            <span className={`type-badge ${tx.type === 'CONTRIBUTION' ? 'contribution' : 'payout'}`}>
                                                {tx.type === 'CONTRIBUTION' ? 'Contribution' : 'Winner Payout'}
                                            </span>
                                        </td>
                                        <td className="amount-cell">{formatCurrency(tx.amount)}</td>
                                        <td className="mode-cell">{tx.paymentMode}</td>
                                        <td className="remarks-cell">{tx.remarks || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                            <div className="pagination">
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(filters.page - 1)}
                                    disabled={filters.page === 1}
                                >
                                    <ChevronLeft size={16} />
                                    Previous
                                </button>
                                <span className="pagination-info">
                                    Page {filters.page} of {pagination.pages}
                                </span>
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(filters.page + 1)}
                                    disabled={filters.page === pagination.pages}
                                >
                                    Next
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TransactionHistory;