import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Send, CheckCircle, XCircle, ArrowUpRight, ArrowDownLeft, Clock, History, ChevronDown, User, AlertTriangle } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import './Dashboard.css';
import './CashTransfers.css';

const CashTransfers = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('PENDING');

    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);

    // Send Cash Modal States
    const [showSendModal, setShowSendModal] = useState(false);
    const [directory, setDirectory] = useState([]);
    const [sendForm, setSendForm] = useState({ toEmployeeId: '', amount: '', reason: '' });
    const [sending, setSending] = useState(false);

    // Custom Dropdown State
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Custom Confirmation Dialog State
    const [confirmModal, setConfirmModal] = useState({ show: false, action: null, transferId: null, title: '', message: '' });
    const [actionProcessing, setActionProcessing] = useState(false);

    useEffect(() => {
        fetchTransfers(activeTab);
    }, [activeTab]);

    const fetchTransfers = async (tab) => {
        setLoading(true);
        try {
            const res = await employeeApi.cashTransfers.getHistory({ limit: 50 });
            if (res.data.success) {
                const allTx = res.data.data.transfers;
                if (tab === 'PENDING') {
                    setTransactions(allTx.filter(tx => tx.status === 'PENDING'));
                } else {
                    setTransactions(allTx.filter(tx => tx.status !== 'PENDING'));
                }
            }
        } catch (err) {
            console.error("Failed to load transfers", err);
        } finally {
            setLoading(false);
        }
    };

    const openSendModal = async () => {
        setShowSendModal(true);
        setDropdownOpen(false);
        try {
            const res = await employeeApi.cashTransfers.getDirectory();
            if (res.data.success) {
                setDirectory(res.data.data.employees);
            }
        } catch (err) {
            alert("Failed to load employee directory");
        }
    };

    const handleSendCash = async (e) => {
        e.preventDefault();

        if (!sendForm.toEmployeeId) {
            alert("Please select an employee first.");
            return;
        }

        setSending(true);
        try {
            await employeeApi.cashTransfers.initiate({
                toEmployeeId: sendForm.toEmployeeId,
                amount: Number(sendForm.amount),
                reason: sendForm.reason
            });
            setShowSendModal(false);
            setSendForm({ toEmployeeId: '', amount: '', reason: '' });
            fetchTransfers(activeTab);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to send cash");
        } finally {
            setSending(false);
        }
    };

    // Open the Custom Confirm Dialog
    const handleActionClick = (transferId, action) => {
        const isConfirm = action === 'confirm';
        setConfirmModal({
            show: true,
            action,
            transferId,
            title: isConfirm ? 'Confirm Receipt' : 'Cancel Transfer',
            message: isConfirm
                ? 'Are you sure you want to confirm receipt of this cash? Your recorded Cash in Hand will increase.'
                : 'Are you sure you want to cancel this transfer request?'
        });
    };

    // Execute the Action from the Dialog
    const executeAction = async () => {
        const { action, transferId } = confirmModal;
        setActionProcessing(true);

        try {
            if (action === 'confirm') {
                await employeeApi.cashTransfers.confirm(transferId);
            } else {
                await employeeApi.cashTransfers.cancel(transferId);
            }
            setConfirmModal({ show: false, action: null, transferId: null, title: '', message: '' });
            fetchTransfers(activeTab);
        } catch (err) {
            alert(err.response?.data?.message || `Failed to ${action} transfer`);
        } finally {
            setActionProcessing(false);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    const selectedEmployeeObj = directory.find(emp => emp._id === sendForm.toEmployeeId);

    return (
        <div className="emp-dash-wrapper">
            <header className="emp-header">
                <div className="header-left">
                    <button className="elder-back-btn" onClick={() => navigate('/employee/dashboard')}>
                        <ArrowLeft size={24} /> <span>Back</span>
                    </button>
                </div>
                <div className="header-center">
                    <h1 className="page-title">Wallet & Cash Transfers</h1>
                </div>
                <div className="header-right"></div>
            </header>

            <main className="emp-main-content">

                <div className="wallet-controls">
                    <div className="wallet-tabs">
                        <button className={`w-tab ${activeTab === 'PENDING' ? 'active' : ''}`} onClick={() => setActiveTab('PENDING')}>
                            <Clock size={18} /> Pending Actions
                        </button>
                        <button className={`w-tab ${activeTab === 'HISTORY' ? 'active' : ''}`} onClick={() => setActiveTab('HISTORY')}>
                            <History size={18} /> Transfer History
                        </button>
                    </div>
                    <button className="emp-btn-primary send-cash-btn" onClick={openSendModal}>
                        <Send size={18} /> Send Cash to Employee
                    </button>
                </div>

                <div className="wallet-list-container">
                    {loading ? (
                        <div className="wallet-empty"><div className="spinner"></div></div>
                    ) : transactions.length === 0 ? (
                        <div className="wallet-empty">
                            <Wallet size={48} opacity={0.3} />
                            <p>No {activeTab.toLowerCase()} transfers found.</p>
                        </div>
                    ) : (
                        <div className="wallet-feed">
                            {transactions.map(tx => {
                                const isSentByMe = tx.direction === 'SENT';

                                return (
                                    <div key={tx._id} className="wallet-card">
                                        <div className="w-card-left">
                                            <div className={`w-icon ${isSentByMe ? 'bg-blue-light text-blue' : 'bg-emerald-light text-emerald'}`}>
                                                {isSentByMe ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                                            </div>
                                            <div className="w-info">
                                                <h4>{isSentByMe ? `Sent to ${tx.to.name}` : `Incoming from ${tx.from.name}`}</h4>
                                                <p>{new Date(tx.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                {tx.reason && <p className="w-reason">"{tx.reason}"</p>}
                                            </div>
                                        </div>

                                        <div className="w-card-right">
                                            <div className="w-amount-block">
                                                <h3 className={isSentByMe ? 'text-blue' : 'text-emerald'}>
                                                    {formatCurrency(tx.amount)}
                                                </h3>
                                                {activeTab === 'HISTORY' && (
                                                    <span className={`w-status ${tx.status === 'CONFIRMED' ? 's-green' : 's-red'}`}>
                                                        {tx.status}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Beautiful Action Buttons for PENDING tab */}
                                            {activeTab === 'PENDING' && (
                                                <div className="w-actions">
                                                    {isSentByMe ? (
                                                        <button className="tx-action-btn btn-cancel" onClick={() => handleActionClick(tx._id, 'cancel')}>
                                                            <XCircle size={18} /> Cancel Request
                                                        </button>
                                                    ) : (
                                                        <button className="tx-action-btn btn-confirm" onClick={() => handleActionClick(tx._id, 'confirm')}>
                                                            <CheckCircle size={18} /> Confirm Receipt
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Custom Confirmation Dialog Modal */}
            {confirmModal.show && (
                <div className="emp-modal-overlay">
                    <div className="emp-modal-card confirm-dialog-card">
                        <div className={`confirm-icon-wrapper ${confirmModal.action === 'confirm' ? 'bg-emerald-light text-emerald' : 'bg-red-light text-red'}`}>
                            {confirmModal.action === 'confirm' ? <CheckCircle size={36} /> : <AlertTriangle size={36} />}
                        </div>
                        <h3>{confirmModal.title}</h3>
                        <p>{confirmModal.message}</p>

                        <div className="modal-actions" style={{ marginTop: '1.5rem', width: '100%' }}>
                            <button
                                type="button"
                                className="emp-btn-secondary"
                                onClick={() => setConfirmModal({ show: false, action: null, transferId: null, title: '', message: '' })}
                                disabled={actionProcessing}
                            >
                                No, Keep it
                            </button>
                            <button
                                type="button"
                                className={`emp-btn-primary ${confirmModal.action === 'cancel' ? 'btn-danger-fill' : 'btn-success-fill'}`}
                                onClick={executeAction}
                                disabled={actionProcessing}
                            >
                                {actionProcessing ? 'Processing...' : `Yes, ${confirmModal.action === 'confirm' ? 'Confirm' : 'Cancel'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Cash Modal */}
            {showSendModal && (
                <div className="emp-modal-overlay">
                    <div className="emp-modal-card">
                        <h3>Send Cash</h3>
                        <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>Transfer physical cash to another approved employee.</p>

                        <form onSubmit={handleSendCash}>
                            <div className="form-group custom-dropdown-container" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Select Employee</label>

                                <div
                                    className={`custom-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                >
                                    {selectedEmployeeObj ? (
                                        <div className="selected-emp-display">
                                            <div className="emp-avatar-mini"><User size={16} /></div>
                                            <span className="selected-emp-name">{selectedEmployeeObj.name}</span>
                                        </div>
                                    ) : (
                                        <span className="placeholder-text">-- Choose an employee --</span>
                                    )}
                                    <ChevronDown size={20} className={`dropdown-arrow ${dropdownOpen ? 'rotated' : ''}`} />
                                </div>

                                {dropdownOpen && (
                                    <div className="custom-dropdown-menu">
                                        {directory.length === 0 ? (
                                            <div className="dropdown-empty">No other employees found.</div>
                                        ) : (
                                            directory.map(emp => (
                                                <div
                                                    key={emp._id}
                                                    className={`custom-dropdown-item ${sendForm.toEmployeeId === emp._id ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSendForm({ ...sendForm, toEmployeeId: emp._id });
                                                        setDropdownOpen(false);
                                                    }}
                                                >
                                                    <div className="emp-avatar-mini"><User size={16} /></div>
                                                    <div className="emp-drop-info">
                                                        <h4>{emp.name}</h4>
                                                        <span>{emp.phoneNumber}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Amount (₹)</label>
                                <input
                                    type="number"
                                    className="emp-select-input"
                                    min="1"
                                    placeholder="0"
                                    value={sendForm.amount}
                                    onChange={e => setSendForm({ ...sendForm, amount: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Reason (Optional)</label>
                                <input
                                    type="text"
                                    className="emp-select-input"
                                    placeholder="e.g. Short on cash for Group A payout"
                                    value={sendForm.reason}
                                    onChange={e => setSendForm({ ...sendForm, reason: e.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="emp-btn-secondary" onClick={() => setShowSendModal(false)}>Cancel</button>
                                <button type="submit" className="emp-btn-primary send-cash-btn" disabled={sending}>
                                    {sending ? 'Sending...' : 'Initiate Transfer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashTransfers;