import React from 'react';
import './Dashboard.css';

const MemberDashboard = () => {
    return (
        <div className="member-dashboard">
            <h1 className="page-title">Welcome, Member</h1>
            <p className="page-subtitle">Your chit fund dashboard</p>

            <div className="placeholder-content">
                <p>This is your member dashboard. Here you will be able to:</p>
                <ul>
                    <li>View your groups</li>
                    <li>Track your contributions</li>
                    <li>View payment history</li>
                    <li>Participate in auctions (future)</li>
                </ul>
                <p className="coming-soon">More features coming soon!</p>
            </div>
        </div>
    );
};

export default MemberDashboard;