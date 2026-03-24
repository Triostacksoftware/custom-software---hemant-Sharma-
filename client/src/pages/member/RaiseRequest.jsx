import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// import './RaiseRequest.css';

const RaiseRequest = () => {
    const navigate = useNavigate();
    return (
        <div className="raise-request-page">
            <button className="back-btn" onClick={() => navigate('/user/dashboard')}>
                <ArrowLeft size={18} /> Back
            </button>
            <h1 className="page-title">Raise Request</h1>
            <p>Coming soon: Form to request contribution collection or payment</p>
        </div>
    );
};

export default RaiseRequest;