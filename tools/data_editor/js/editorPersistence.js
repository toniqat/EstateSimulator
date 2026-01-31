/**
 * Editor Persistence Module
 * Manages IndexedDB and File System Access API for folder persistence
 * Provides:
 * - Directory handle storage and retrieval
 * - Fallback localStorage for unsupported browsers
 * - Browser capability detection
 */

class EditorPersistence {
    constructor() {
        this.db = null;
        this.currentDirHandle = null;
        this.isSupported = this._checkSupport();
        this.useIndexedDB = this.isSupported.indexedDB;
    }

    /**
     * Check browser support for required APIs
     * @returns {Object} Support status for each API
     * @private
     */
    _checkSupport() {
        return {
            fileSystemAccess: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
            indexedDB: typeof window !== 'undefined' && window.indexedDB,
            localStorage: typeof window !== 'undefined' && window.localStorage,
        };
    }

    /**
     * Get a summary of browser support
     * @returns {Object} Human-readable support info
     */
    getBrowserSupport() {
        return {
            fileSystemAccess: this.isSupported.fileSystemAccess ? '✓ Supported' : '✗ Not supported',
            indexedDB: this.isSupported.indexedDB ? '✓ Supported' : '✗ Not supported',
            localStorage: this.isSupported.localStorage ? '✓ Supported' : '✗ Not supported',
            supportsDirectoryPersistence: this.isSupported.fileSystemAccess && this.isSupported.indexedDB,
            fallbackAvailable: this.isSupported.localStorage,
        };
    }

    /**
     * Initialize persistence system
     * Sets up IndexedDB if available
     * @returns {Promise<void>}
     */
    async initialize() {
        if (!this.useIndexedDB) {
            console.warn('IndexedDB not available, using localStorage fallback');
            return;
        }

        try {
            this.db = await this._openDB();
            console.log('EditorPersistence: IndexedDB initialized');
        } catch (error) {
            console.warn('EditorPersistence: Failed to initialize IndexedDB, falling back to localStorage:', error);
            this.useIndexedDB = false;
        }
    }

    /**
     * Open IndexedDB database
     * @returns {Promise<IDBDatabase>}
     * @private
     */
    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EstateSimulatorEditor', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('folderHandles')) {
                    db.createObjectStore('folderHandles', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Save directory handle for future sessions
     * Stores both in IndexedDB (primary) and localStorage (fallback)
     * @param {FileSystemDirectoryHandle} dirHandle - Directory handle to save
     * @returns {Promise<void>}
     */
    async saveDirectoryHandle(dirHandle) {
        if (!dirHandle) return;

        this.currentDirHandle = dirHandle;

        // Try IndexedDB first
        if (this.useIndexedDB && this.db) {
            try {
                await this._saveToIndexedDB('folderHandles', {
                    key: 'lastFolder',
                    handle: dirHandle,
                    name: dirHandle.name,
                    timestamp: Date.now(),
                });
                console.log('EditorPersistence: Directory handle saved to IndexedDB');
                return;
            } catch (error) {
                console.warn('EditorPersistence: Failed to save to IndexedDB:', error);
            }
        }

        // Fallback to localStorage (only stores path info)
        this._saveToLocalStorage('editorPersistence_lastFolder', {
            name: dirHandle.name,
            timestamp: Date.now(),
        });
        console.log('EditorPersistence: Directory info saved to localStorage (fallback)');
    }

    /**
     * Retrieve last saved directory handle
     * Tries IndexedDB first, falls back to localStorage
     * Note: Does NOT request permission (requires user activation)
     * Only verifies if permission is already granted
     * Returns null if handle exists but permission is not granted (user can restore)
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    async getDirectoryHandle() {
        // Try IndexedDB first
        if (this.useIndexedDB && this.db) {
            try {
                const data = await this._getFromIndexedDB('folderHandles', 'lastFolder');
                if (data && data.handle) {
                    // Verify handle is still valid by testing actual access
                    // This will check if permission is still granted without requesting it
                    if (await this._verifyHandleValidity(data.handle)) {
                        this.currentDirHandle = data.handle;
                        console.log('EditorPersistence: Retrieved directory handle from IndexedDB');
                        return data.handle;
                    } else {
                        console.warn('EditorPersistence: Stored handle is no longer accessible (permission may have been revoked)');
                        // Don't clear the handle here - let the caller decide what to do
                        // It might still be restorable with requestPermission()
                    }
                }
            } catch (error) {
                console.warn('EditorPersistence: Failed to retrieve from IndexedDB:', error);
            }
        }

        // Check localStorage for fallback info
        const fallbackData = this._getFromLocalStorage('editorPersistence_lastFolder');
        if (fallbackData) {
            console.log('EditorPersistence: Found folder info in localStorage (fallback):', fallbackData.name);
        }

        return null;
    }

    /**
     * Request directory access from user
     * Saves the handle if permission is granted
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    async requestDirectoryAccess() {
        if (!this.isSupported.fileSystemAccess) {
            throw new Error('File System Access API not supported in this browser');
        }

        try {
            const dirHandle = await window.showDirectoryPicker();
            await this.saveDirectoryHandle(dirHandle);
            return dirHandle;
        } catch (error) {
            if (error.name === 'AbortError') {
                return null; // User cancelled
            }
            throw error;
        }
    }

    /**
     * Attempt to restore permission for a stale handle
     * Only call this with user activation (e.g., button click)
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    async restoreDirectoryHandleWithPermission() {
        if (!this.useIndexedDB || !this.db) {
            console.warn('EditorPersistence: Cannot restore - IndexedDB not available');
            return null;
        }

        try {
            const data = await this._getFromIndexedDB('folderHandles', 'lastFolder');
            if (!data || !data.handle) {
                console.log('EditorPersistence: No stored handle to restore');
                return null;
            }

            console.log('EditorPersistence: Attempting to restore permission for:', data.name);

            // Request permission with user activation
            const permission = await data.handle.requestPermission({ mode: 'read' });
            if (permission === 'granted') {
                // Verify handle works
                if (await this._verifyHandleValidity(data.handle)) {
                    this.currentDirHandle = data.handle;
                    console.log('EditorPersistence: Successfully restored directory handle with permission');
                    return data.handle;
                } else {
                    console.warn('EditorPersistence: Handle still not accessible after permission grant');
                }
            } else {
                console.log('EditorPersistence: Permission request denied or dismissed');
            }
        } catch (error) {
            console.warn('EditorPersistence: Could not restore permission:', error.name, '-', error.message);
        }

        // Clear the invalid handle
        try {
            await this._deleteFromIndexedDB('folderHandles', 'lastFolder');
            console.log('EditorPersistence: Cleared invalid handle from storage');
        } catch (e) {
            console.warn('EditorPersistence: Failed to clear invalid handle:', e.message);
        }

        return null;
    }

    /**
     * Verify directory handle validity by testing actual access
     * This is more reliable than just checking queryPermission
     * Only returns true if permission is already granted (not "prompt")
     * @param {FileSystemDirectoryHandle} handle - Handle to verify
     * @returns {Promise<boolean>}
     * @private
     */
    async _verifyHandleValidity(handle) {
        if (!handle) return false;

        try {
            // Check permission state - must be "granted", not "prompt"
            // "prompt" means permission hasn't been granted yet
            const permission = await handle.queryPermission({ mode: 'read' });
            if (permission !== 'granted') {
                console.log('EditorPersistence: Handle permission not granted (state: ' + permission + ')');
                return false;
            }

            // Then actually try to list a single entry (this is the real test)
            for await (const _ of handle.entries()) {
                // If we can read at least one entry, the handle is valid
                console.log('EditorPersistence: Handle verified - can access entries');
                return true;
            }
            // Empty directory is also valid
            console.log('EditorPersistence: Handle verified - empty directory');
            return true;
        } catch (error) {
            console.warn('EditorPersistence: Handle validity check failed:', error.name, '-', error.message);
            return false;
        }
    }

    /**
     * Check if a stored directory handle is still accessible
     * Verifies that permission is granted and handle works
     * @returns {Promise<boolean>}
     */
    async isStoredHandleValid() {
        const handle = await this.getDirectoryHandle();
        if (!handle) return false;

        return this._verifyHandleValidity(handle);
    }

    /**
     * Check if a stored directory handle exists and might be restorable
     * This is a quick check that doesn't attempt to access the handle
     * Use this to determine if showing a "restore" option makes sense
     * @returns {Promise<boolean>}
     */
    async hasStoredHandle() {
        if (!this.useIndexedDB || !this.db) {
            return false;
        }

        try {
            const data = await this._getFromIndexedDB('folderHandles', 'lastFolder');
            return !!(data && data.handle);
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all stored data
     * @returns {Promise<void>}
     */
    async clearAll() {
        if (this.useIndexedDB && this.db) {
            try {
                await this._deleteFromIndexedDB('folderHandles', 'lastFolder');
                await this._deleteFromIndexedDB('settings', 'lastFolder');
            } catch (error) {
                console.warn('EditorPersistence: Error clearing IndexedDB:', error);
            }
        }

        this._deleteFromLocalStorage('editorPersistence_lastFolder');
        this.currentDirHandle = null;
    }

    /* ======================================
       IndexedDB Helper Methods
       ====================================== */

    /**
     * Save data to IndexedDB
     * @param {string} storeName - Object store name
     * @param {Object} data - Data to save (must have 'key' property)
     * @returns {Promise<void>}
     * @private
     */
    _saveToIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Retrieve data from IndexedDB
     * @param {string} storeName - Object store name
     * @param {string} key - Key to retrieve
     * @returns {Promise<Object|null>}
     * @private
     */
    _getFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    }

    /**
     * Delete data from IndexedDB
     * @param {string} storeName - Object store name
     * @param {string} key - Key to delete
     * @returns {Promise<void>}
     * @private
     */
    _deleteFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /* ======================================
       localStorage Helper Methods (Fallback)
       ====================================== */

    /**
     * Save data to localStorage
     * @param {string} key - Key name
     * @param {Object} data - Data to save
     * @private
     */
    _saveToLocalStorage(key, data) {
        if (!this.isSupported.localStorage) return;
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn('EditorPersistence: Failed to save to localStorage:', error);
        }
    }

    /**
     * Retrieve data from localStorage
     * @param {string} key - Key name
     * @returns {Object|null}
     * @private
     */
    _getFromLocalStorage(key) {
        if (!this.isSupported.localStorage) return null;
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('EditorPersistence: Failed to load from localStorage:', error);
            return null;
        }
    }

    /**
     * Delete data from localStorage
     * @param {string} key - Key name
     * @private
     */
    _deleteFromLocalStorage(key) {
        if (!this.isSupported.localStorage) return;
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('EditorPersistence: Failed to delete from localStorage:', error);
        }
    }
}
