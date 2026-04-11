import React, { useState, useEffect, useRef } from 'react';
import { Bell, ChevronLeft, ChevronRight, Gavel, CheckCircle, Clock, Users, IndianRupee, AlertTriangle, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './BellNotification.css';

const BellNotification = ({ api }) => {
    const { socket } = useAuth();
    const [notifications, setNotifications] = useState(0); // Unread count
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifList, setNotifList] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [viewAllMode, setViewAllMode] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const notifRef = useRef(null);

    // 1. Fetch initial unread count on mount
    useEffect(() => {
        api.getUnreadNotifications()
            .then(res => {
                if (res.data.success) setNotifications(res.data.data.count);
            })
            .catch(err => console.error("Failed to load notifications", err));
    }, [api]);

    // 2. Real-time Socket Listener for incoming notifications
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (data) => {
            // Increment the red badge count in real-time
            setNotifications(prev => prev + 1);

            // Optional: If the user happens to have the "Recent" dropdown open right now,
            // you could automatically fetch the new list here. But standard UX is to just show the badge.
        };

        socket.on("newNotification", handleNewNotification);

        return () => {
            socket.off("newNotification", handleNewNotification);
        };
    }, [socket]);

    // Handle clicks outside the notification modal to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
                setViewAllMode(false); // Reset to default view when closed
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = async () => {
        const newOpenState = !isNotifOpen;
        setIsNotifOpen(newOpenState);

        // Fetch Recent Unread when opening
        if (newOpenState) {
            setViewAllMode(false);
            setLoadingNotifs(true);
            try {
                const response = await api.getNotificationsList(true, 5, 1);
                if (response.data.success) {
                    const fetchedNotifs = response.data.data.notifications;
                    setNotifList(fetchedNotifs);
                    // Backend marks these as read, so decrement our local unread badge count
                    setNotifications(prev => Math.max(0, prev - fetchedNotifs.length));
                }
            } catch (error) {
                console.error("Failed to fetch unread notifications", error);
            } finally {
                setLoadingNotifs(false);
            }
        }
    };

    const fetchAllNotifications = async (page = 1) => {
        setLoadingNotifs(true);
        setViewAllMode(true);
        try {
            // Fetch all notifications (unreadOnly = false), 10 per page
            const response = await api.getNotificationsList(false, 10, page);
            if (response.data.success) {
                setNotifList(response.data.data.notifications);
                setCurrentPage(response.data.data.pagination.page);
                setTotalPages(response.data.data.pagination.totalPages);
            }
        } catch (error) {
            console.error("Failed to fetch all notifications", error);
        } finally {
            setLoadingNotifs(false);
        }
    };

    // Helper to select the right icon based on Notification Type
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'GROUP_ACTIVATED': return <CheckCircle size={16} className="text-emerald" />;
            case 'BIDDING_OPEN': return <Gavel size={16} className="text-blue" />;
            case 'BIDDING_CLOSED': return <CheckCircle size={16} className="text-emerald" />;
            case 'PAYMENT_CONFIRMED': return <CheckCircle size={16} className="text-emerald" />;
            case 'PAYMENT_REMINDER': return <Clock size={16} className="text-amber" />;
            case 'GROUP_JOIN_REQUEST': return <Users size={16} className="text-blue" />;
            case 'PAYMENT_COLLECTION_REQUEST': return <IndianRupee size={16} className="text-emerald" />;
            case 'BIDDING_TIE': return <AlertTriangle size={16} className="text-rose" />;
            case 'FINALIZE_BLOCKED': return <AlertTriangle size={16} className="text-rose" />;
            default: return <Bell size={16} className="text-slate" />;
        }
    };

    return (
        <div className="notification-wrapper" ref={notifRef}>
            <button className="icon-btn notification-btn" onClick={handleNotificationClick}>
                <Bell size={26} />
                {notifications > 0 && <span className="badge">{notifications}</span>}
            </button>

            {isNotifOpen && (
                <div className={`notification-modal ${viewAllMode ? 'expanded' : ''}`}>
                    <div className="notif-header">
                        <h4>{viewAllMode ? 'All Notifications' : 'Recent Notifications'}</h4>
                        {notifications > 0 && !viewAllMode && <span className="notif-count">{notifications} New</span>}
                    </div>

                    <div className={`notif-body ${viewAllMode ? 'expanded-body' : ''}`}>
                        {loadingNotifs ? (
                            <div className="notif-empty">
                                <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                            </div>
                        ) : notifList.length === 0 ? (
                            <div className="notif-empty">
                                <Bell size={32} className="empty-bell" />
                                <p>{viewAllMode ? 'Inbox is empty' : 'No new messages'}</p>
                            </div>
                        ) : (
                            <ul className="notif-list">
                                {notifList.map((notif) => (
                                    <li key={notif._id} className={`notif-item ${!notif.isRead ? 'unread' : ''}`}>
                                        <div className="notif-icon">
                                            {getNotificationIcon(notif.type)}
                                        </div>
                                        <div className="notif-content">
                                            <p className="notif-title">{notif.title}</p>
                                            <p className="notif-desc">{notif.body}</p>
                                            <span className="notif-time">
                                                {new Date(notif.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Dynamic Footer */}
                    {!viewAllMode ? (
                        <div className="notif-footer" onClick={() => fetchAllNotifications(1)}>
                            View all notifications
                        </div>
                    ) : (
                        <div className="notif-pagination-footer">
                            <button
                                className="page-btn"
                                disabled={currentPage === 1 || loadingNotifs}
                                onClick={() => fetchAllNotifications(currentPage - 1)}
                            >
                                <ChevronLeft size={16} /> Prev
                            </button>
                            <span className="page-info">Page {currentPage} of {totalPages || 1}</span>
                            <button
                                className="page-btn"
                                disabled={currentPage === totalPages || totalPages === 0 || loadingNotifs}
                                onClick={() => fetchAllNotifications(currentPage + 1)}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BellNotification;