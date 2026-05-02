import { offlineStorage } from './offlineStorage';
import { API_BASE_URL } from '../config/api';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
  }

  // Add listener for sync events
  addSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  // Remove listener
  removeSyncListener(callback) {
    this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
  }

  // Notify all listeners
  notifyListeners(event, data) {
    this.syncListeners.forEach(callback => callback(event, data));
  }

  // Sync all pending attendance records
  async syncAttendance() {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      console.log('Cannot sync: offline');
      return;
    }

    this.isSyncing = true;
    this.notifyListeners('sync-start', {});

    try {
      const unsyncedRecords = await offlineStorage.getUnsyncedAttendance();
      
      if (unsyncedRecords.length === 0) {
        console.log('No records to sync');
        this.notifyListeners('sync-complete', { synced: 0, failed: 0 });
        return;
      }

      console.log(`Syncing ${unsyncedRecords.length} attendance records...`);
      
      let syncedCount = 0;
      let failedCount = 0;
      const failedRecords = [];

      for (const record of unsyncedRecords) {
        try {
          // Check record type and use appropriate API endpoint
          if (record.type === 'member_checkin') {
            // Member check-in via QR scan
            // First, check in the primary member
            const response = await fetch(`${API_BASE_URL}/api/qr_sessions/checkin.php`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_token: record.data.session_token,
                member_id: record.data.member_id,
                member_name: record.data.member_name,
                member_contact: record.data.member_contact
              })
            });

            if (response.ok) {
              // Check in family members if any
              if (record.data.family_members && record.data.family_members.length > 0) {
                for (const familyMember of record.data.family_members) {
                  try {
                    await fetch(`${API_BASE_URL}/api/qr_sessions/checkin.php`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(familyMember)
                    });
                  } catch (error) {
                    console.error(`Failed to sync family member:`, error);
                  }
                }
              }
              
              await offlineStorage.markAttendanceSynced(record.id);
              syncedCount++;
              console.log(`Synced member check-in ${record.id}`);
            } else {
              failedCount++;
              failedRecords.push(record);
              console.error(`Failed to sync member check-in ${record.id}:`, response.status);
            }
          } else {
            // Admin marking attendance
            const response = await fetch(`${API_BASE_URL}/api/attendance/record.php`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                event_id: record.eventId,
                attendance_data: record.data.attendance_data || record.data
              })
            });

            if (response.ok) {
              await offlineStorage.markAttendanceSynced(record.id);
              syncedCount++;
              console.log(`Synced record ${record.id}`);
            } else {
              failedCount++;
              failedRecords.push(record);
              console.error(`Failed to sync record ${record.id}:`, response.status);
            }
          }
        } catch (error) {
          failedCount++;
          failedRecords.push(record);
          console.error(`Error syncing record ${record.id}:`, error);
        }
      }

      // Clean up synced records
      if (syncedCount > 0) {
        await offlineStorage.deleteSyncedAttendance();
      }

      this.notifyListeners('sync-complete', { 
        synced: syncedCount, 
        failed: failedCount,
        failedRecords 
      });

      console.log(`Sync complete: ${syncedCount} synced, ${failedCount} failed`);
    } catch (error) {
      console.error('Sync error:', error);
      this.notifyListeners('sync-error', { error });
    } finally {
      this.isSyncing = false;
    }
  }

  // Start auto-sync when online
  startAutoSync() {
    // Sync when coming back online
    window.addEventListener('online', () => {
      console.log('Back online - starting sync...');
      setTimeout(() => this.syncAttendance(), 1000);
    });

    // Periodic sync every 30 seconds if online
    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncAttendance();
      }
    }, 30000);
  }

  // Get sync status
  async getSyncStatus() {
    const unsyncedRecords = await offlineStorage.getUnsyncedAttendance();
    return {
      pending: unsyncedRecords.length,
      isSyncing: this.isSyncing,
      isOnline: navigator.onLine
    };
  }
}

export const syncManager = new SyncManager();
