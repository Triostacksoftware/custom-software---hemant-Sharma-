import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// import './Bidding.css';

const Bidding = () => {
    const navigate = useNavigate();
    return (
        <div className="bidding-page">
            <button className="back-btn" onClick={() => navigate('/user/dashboard')}>
                <ArrowLeft size={18} /> Back
            </button>
            <h1 className="page-title">Bidding</h1>
            <p>Coming soon: List of active and upcoming bidding rounds</p>
        </div>
    );
};

export default Bidding;