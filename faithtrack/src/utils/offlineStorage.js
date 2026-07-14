// IndexedDB wrapper for offline storage
class OfflineStorage {
  constructor() {
    this.dbName = 'FaithTrackDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for pending actions (to sync when online)
        if (!db.objectStoreNames.contains('pendingActions')) {
          db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
        }

        // Store for cached data
        if (!db.objectStoreNames.contains('cachedData')) {
          const cachedStore = db.createObjectStore('cachedData', { keyPath: 'key' });
          cachedStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for members
        if (!db.objectStoreNames.contains('members')) {
          db.createObjectStore('members', { keyPath: 'id' });
        }

        // Store for events
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'id' });
        }

        // Store for attendance
        if (!db.objectStoreNames.contains('attendance')) {
          const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
          attendanceStore.createIndex('eventId', 'eventId', { unique: false });
          attendanceStore.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }

  async saveData(storeName, data) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getData(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllData(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteData(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearStore(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache members data
  async cacheMembers(members) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['members'], 'readwrite');
    const store = transaction.objectStore('members');

    // Clear existing data
    await store.clear();

    // Add all members
    for (const member of members) {
      await store.put(member);
    }

    // Update cache timestamp
    await this.saveData('cachedData', {
      key: 'members_timestamp',
      timestamp: Date.now()
    });
  }

  // Cache events data
  async cacheEvents(events) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['events'], 'readwrite');
    const store = transaction.objectStore('events');

    // Clear existing data
    await store.clear();

    // Add all events
    for (const event of events) {
      await store.put(event);
    }

    // Update cache timestamp
    await this.saveData('cachedData', {
      key: 'events_timestamp',
      timestamp: Date.now()
    });
  }

  // Save attendance offline (for admin marking attendance)
  async saveAttendanceOffline(eventId, attendanceData) {
    return await this.saveData('attendance', {
      eventId,
      data: attendanceData,
      timestamp: Date.now(),
      synced: false,
      type: 'admin_marking'
    });
  }

  // Get unsynced attendance
  async getUnsyncedAttendance() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['attendance'], 'readonly');
      const store = transaction.objectStore('attendance');
      const request = store.getAll();

      request.onsuccess = () => {
        // Filter for unsynced records
        const allRecords = request.result || [];
        const unsyncedRecords = allRecords.filter(record => record.synced === false);
        resolve(unsyncedRecords);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Mark attendance as synced
  async markAttendanceSynced(id) {
    const attendance = await this.getData('attendance', id);
    if (attendance) {
      attendance.synced = true;
      await this.saveData('attendance', attendance);
    }
  }

  // Get attendance by event ID
  async getAttendanceByEvent(eventId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['attendance'], 'readonly');
      const store = transaction.objectStore('attendance');
      const index = store.index('eventId');
      const request = index.getAll(eventId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete synced attendance records (cleanup)
  async deleteSyncedAttendance() {
    if (!this.db) await this.init();

    const unsynced = await this.getUnsyncedAttendance();
    const transaction = this.db.transaction(['attendance'], 'readwrite');
    const store = transaction.objectStore('attendance');
    
    // Clear all and re-add unsynced
    await store.clear();
    for (const record of unsynced) {
      await store.put(record);
    }
  }

  // Add pending action
  async addPendingAction(action) {
    return await this.saveData('pendingActions', {
      ...action,
      timestamp: Date.now()
    });
  }

  // Get all pending actions
  async getPendingActions() {
    return await this.getAllData('pendingActions');
  }

  // Remove pending action
  async removePendingAction(id) {
    return await this.deleteData('pendingActions', id);
  }
}

export const offlineStorage = new OfflineStorage();
