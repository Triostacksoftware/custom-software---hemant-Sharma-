import React from 'react';
import './RoleCard.css';

const RoleCard = ({
    title,
    description,
    icon,
    primaryColor,
    onLogin,
    onSignup,
    isPrimary
}) => {
    return (
        <div className={`role-card ${isPrimary ? 'primary' : ''}`}>
            <div className="role-icon-wrapper">
                <div className="role-icon" style={{ color: primaryColor }}>
                    {icon}
                </div>
            </div>
            <h3 className="role-title">{title}</h3>
            <p className="role-description">{description}</p>

            <div className="role-actions">
                {onSignup && (
                    <button
                        className="role-btn secondary"
                        onClick={onSignup}
                    >
                        Register
                    </button>
                )}

                {onLogin && (
                    <button
                        className="role-btn primary"
                        onClick={onLogin}
                        style={{
                            background: primaryColor,
                            borderColor: primaryColor
                        }}
                    >
                        Login
                    </button>
                )}
            </div>
        </div>
    );
};

export default RoleCard;