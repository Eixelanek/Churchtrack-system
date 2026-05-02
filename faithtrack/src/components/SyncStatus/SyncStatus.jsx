import React, { useState, useEffect } from 'react';
import './SyncStatus.css';
import { syncManager } from '../../utils/syncManager';
import { offlineStorage } from '../../utils/offlineStorage';

const SyncStatus = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    // Load initial status
    loadStatus();

    // Listen for sync events
    const handleSyncEvent = (event, data) => {
      if (event === 'sync-start') {
        setIsSyncing(true);
        setLastError(null);
      } else if (event === 'sync-complete') {
        setIsSyncing(false);
        loadStatus();
        if (data.failed > 0) {
          setLastError(`${data.failed} record(s) failed to sync`);
        }
      } else if (event === 'sync-error') {
        setIsSyncing(false);
        setLastError(data.error?.message || 'Sync error occurred');
      }
    };

    syncManager.addSyncListener(handleSyncEvent);

    // Poll for status updates
    const interval = setInterval(loadStatus, 5000);

    return () => {
      syncManager.removeSyncListener(handleSyncEvent);
      clearInterval(interval);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const unsynced = await offlineStorage.getUnsyncedAttendance();
      setPendingCount(unsynced.length);
      
      // Log for debugging
      if (unsynced.length > 0) {
        console.log('Pending sync records:', unsynced);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const handleManualSync = () => {
    console.log('Manual sync triggered');
    syncManager.syncAttendance().catch(error => {
      alert('Sync failed: ' + error.message);
    });
  };

  if (pendingCount === 0 && !isSyncing) {
    return null; // Don't show if nothing to sync
  }

  return (
    <div className="sync-status-container" style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 9999 }}>
      <div 
        className={`sync-status-badge ${isSyncing ? 'syncing' : 'pending'}`}
        onClick={() => setShowDetails(!showDetails)}
        style={{ cursor: 'pointer' }}
      >
        {isSyncing ? (
          <>
            <div className="sync-spinner"></div>
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{pendingCount} pending</span>
          </>
        )}
      </div>

      {showDetails && (
        <div className="sync-status-details">
          <div className="sync-status-header">
            <h4>Attendance Sync Status</h4>
            <button 
              className="sync-close-btn"
              onClick={() => setShowDetails(false)}
            >
              ×
            </button>
          </div>
          <div className="sync-status-body">
            <div className="sync-status-info">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <p>
                {isSyncing 
                  ? 'Syncing attendance records to server...'
                  : `${pendingCount} attendance record${pendingCount !== 1 ? 's' : ''} waiting to sync`
                }
              </p>
            </div>
            {!isSyncing && navigator.onLine && (
              <button 
                className="sync-now-btn"
                onClick={handleManualSync}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Sync Now
              </button>
            )}
            {!navigator.onLine && (
              <div className="sync-offline-notice">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                </svg>
                <span>Will sync automatically when back online</span>
              </div>
            )}
            {lastError && (
              <div className="sync-error-notice" style={{
                padding: '0.75rem',
                backgroundColor: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                marginTop: '0.5rem',
                color: '#991b1b',
                fontSize: '0.875rem'
              }}>
                <strong>Error:</strong> {lastError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatus;
