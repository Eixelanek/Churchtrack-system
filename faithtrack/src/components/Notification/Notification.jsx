import React from 'react';
import './Notification.css';

const Notification = ({ message, type = 'info', onClose }) => {
  return (
    <div className="notification-overlay">
      <div className={`notification-modal ${type}`}>
        <div className="notification-content">
          <div className="notification-icon">
            {type === 'success' && '✓'}
            {type === 'error' && '✕'}
            {type === 'warning' && '⚠️'}
            {type === 'info' && 'ℹ️'}
          </div>
          <div className="notification-message">{message}</div>
        </div>
        <button className="notification-close" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
};

export default Notification; 