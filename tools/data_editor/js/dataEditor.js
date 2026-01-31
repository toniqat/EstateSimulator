/**
 * Main Data Editor Application Controller
 * Orchestrates all modules and manages application state
 */

class DataEditor {
    constructor() {
        this.fileExplorer = null;
        this.rowList = null;
        this.dataInspector = null;
        this.tabManager = null;
        this.persistence = null;

        this.currentFile = null;
        this.currentHeaders = [];
        this.currentRows = [];
        this.currentIdColumn = null;
        this.currentTypeInfo = {};

        this.modifiedFiles = new Set();
        this.openFiles = new Map(); // Map of path -> { file, headers, rows, idColumn }

        // Selection history: Map of file path -> row ID
        this.selectionHistory = this._loadSelectionHistory();

        // Last viewed file path
        this.lastViewedFilePath = this._loadLastViewedFilePath();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize persistence system
            this.persistence = new EditorPersistence();
            await this.persistence.initialize();
            this._logBrowserSupport();

            // Initialize TabManager
            const tabsListContainer = document.getElementById('tabsList');
            this.tabManager = new TabManager(tabsListContainer);
            this.tabManager.onTabChanged = (filePath, isNewTab) => this._onTabChanged(filePath, isNewTab);

            // Initialize components
            this._setupComponents();

            // Setup keyboard shortcuts
            this._setupKeyboardShortcuts();

            // Try to auto-load last folder if stored
            await this._tryAutoLoadFolder();

            UIComponents.updateStatus('Ready. Click "📁" to open a data directory.');
        } catch (error) {
            console.error('Failed to initialize:', error);
            UIComponents.showToast('Failed to initialize application', 'error');
        }
    }

    /**
     * Handle tab change event from TabManager
     * @private
     */
    _onTabChanged(filePath, _isNewTab) {
        if (!filePath) {
            // All tabs closed - clear the UI
            this.currentFile = null;
            this.currentHeaders = [];
            this.currentRows = [];
            this.currentIdColumn = null;
            this.currentTypeInfo = {};
            this._updateStatus();
            const rowListContainer = document.getElementById('rowList');
            if (rowListContainer) {
                rowListContainer.innerHTML = '<p class="placeholder">Select a CSV file to see rows</p>';
            }
            this.dataInspector.clear();
            return;
        }

        // Load the file data for this tab
        const fileData = this.openFiles.get(filePath);
        if (fileData) {
            // Restore file data from cache
            this.currentFile = fileData.file;
            this.currentHeaders = fileData.headers;
            this.currentRows = fileData.rows;
            this.currentIdColumn = fileData.idColumn;
            this.currentTypeInfo = fileData.typeInfo || TypeInference.inferAllTypes(this.currentHeaders, this.currentRows);

            // Update UI
            this._updateStatus();
            this.rowList.loadRows(this.currentRows, this.currentIdColumn, this.currentHeaders);
            this.dataInspector.clear();

            // Auto-select row: restore previous selection or select first row
            this._autoSelectRow(filePath, this.currentRows, this.currentIdColumn);
        }
    }

    /**
     * Setup all components
     * @private
     */
    _setupComponents() {
        // File Explorer
        const fileTreeContainer = document.getElementById('fileTree');
        const explorerHeader = document.querySelector('.pane-left .pane-header');
        this.fileExplorer = new FileExplorer(fileTreeContainer, explorerHeader, this.persistence);
        this.fileExplorer.onFileSelected = (file) => this._onFileSelected(file);
        this.fileExplorer.onDirectoryLoaded = () => this._onDirectoryLoaded();

        // Row List
        const rowListContainer = document.getElementById('rowList');
        const searchContainer = document.querySelector('.pane-middle .pane-header');
        this.rowList = new RowList(rowListContainer, searchContainer);
        this.rowList.onSelectionChanged = (selectedIds) => this._onRowSelectionChanged(selectedIds);

        // Data Inspector
        const inspectorContainer = document.getElementById('inspector');
        this.dataInspector = new DataInspector(inspectorContainer);
        this.dataInspector.onDataChanged = () => this._onDataChanged();
        this.dataInspector.onAddColumn = () => this._onAddColumnClicked();

        // Inspector View Toggle Button
        const viewToggleBtn = document.getElementById('inspectorViewToggle');
        viewToggleBtn.addEventListener('click', () => this._toggleInspectorView());

        // Add Row Button
        const addRowBtn = document.getElementById('addRowBtn');
        addRowBtn.addEventListener('click', () => this._onAddRowClicked());

        // Delete Row Button
        const deleteRowBtn = document.getElementById('deleteRowBtn');
        deleteRowBtn.addEventListener('click', () => this._onDeleteRowClicked());
    }

    /**
     * Handle file selection from file explorer
     * @private
     */
    async _onFileSelected(file) {
        try {
            // Check if file is already open
            if (this.tabManager.isTabOpen(file.path)) {
                // Switch to existing tab
                this.tabManager.switchToTab(file.path);
                // Save the file path as last viewed
                this._saveLastViewedFilePath(file.path);
                return;
            }

            // New file - open tab and load data
            UIComponents.updateStatus(`Loading ${file.name}...`);

            // Parse CSV
            const { headers, rows } = CSVParser.parse(file.content);

            if (headers.length === 0) {
                UIComponents.showToast('Invalid CSV file', 'error');
                return;
            }

            // Get ID column
            const idColumn = CSVParser.getIdColumn(headers);

            // Infer types
            const typeInfo = TypeInference.inferAllTypes(headers, rows);

            // Store in memory
            this.currentFile = file;
            this.currentHeaders = headers;
            this.currentRows = rows;
            this.currentIdColumn = idColumn;
            this.currentTypeInfo = typeInfo;

            // Cache this file
            this.openFiles.set(file.path, { file, headers, rows, idColumn, typeInfo });

            // Create tab for this file
            this.tabManager.openTab(file.path, file.name, file.fileHandle);

            // Update UI
            this._updateStatus();
            this.rowList.loadRows(rows, idColumn, headers);
            this.dataInspector.clear();

            // Auto-select row: restore previous selection or select first row
            this._autoSelectRow(file.path, rows, idColumn);

            // Save the file path as last viewed
            this._saveLastViewedFilePath(file.path);

            UIComponents.updateStatus(`Loaded ${file.name} (${rows.length} rows)`);
        } catch (error) {
            console.error('Error loading file:', error);
            UIComponents.showToast(`Error loading file: ${error.message}`, 'error');
        }
    }

    /**
     * Handle directory loaded event from FileExplorer
     * Attempts to restore the last viewed file
     * @private
     */
    _onDirectoryLoaded() {
        // If we have a last viewed file path, try to restore it
        if (this.lastViewedFilePath && this.fileExplorer.csvFileMap.has(this.lastViewedFilePath)) {
            const fileHandle = this.fileExplorer.csvFileMap.get(this.lastViewedFilePath);

            // Simulate file selection by calling the internal method
            // We need to find the file element and trigger the selection
            const fileElements = this.fileExplorer.container.querySelectorAll('.file-tree-item.file');
            for (const element of fileElements) {
                if (element.textContent.trim() === fileHandle.name) {
                    // Programmatically select this file
                    this.fileExplorer._selectFile(element, fileHandle, this.lastViewedFilePath);
                    return;
                }
            }
        }
    }

    /**
     * Handle row selection change
     * @private
     */
    _onRowSelectionChanged(selectedIds) {
        // Get the selected row indices from rowList
        const selectedIndices = this.rowList.getSelectedIndices();

        this.dataInspector.load(
            this.currentHeaders,
            this.currentRows,
            this.currentIdColumn,
            selectedIndices,
            this.currentTypeInfo
        );
        this._updateInspectorViewButtonText();

        // Save selection to history
        if (this.currentFile) {
            this._saveSelectionToHistory(this.currentFile.path, selectedIds);
        }
    }

    /**
     * Handle data change in inspector
     * @private
     */
    _onDataChanged() {
        if (this.currentFile && !this.modifiedFiles.has(this.currentFile.path)) {
            this.modifiedFiles.add(this.currentFile.path);
            this._updateStatus();
        }
    }

    /**
     * Update status text and modified indicators
     * @private
     */
    _updateStatus() {
        if (!this.currentFile) return;

        let status = `${this.currentFile.name} • ${this.currentRows.length} rows`;
        if (this.modifiedFiles.size > 0) {
            status += ` • ⚠ ${this.modifiedFiles.size} file${this.modifiedFiles.size !== 1 ? 's' : ''} unsaved`;
        }

        UIComponents.updateStatus(status);
    }

    /**
     * Save current file
     */
    async saveCurrentFile() {
        if (!this.currentFile) {
            UIComponents.showToast('No file selected', 'warning');
            return;
        }

        try {
            await this._saveFile(this.currentFile);
            this.modifiedFiles.delete(this.currentFile.path);
            this._updateStatus();
            UIComponents.showToast(`✓ ${this.currentFile.name} saved`, 'success');
        } catch (error) {
            console.error('Error saving file:', error);
            UIComponents.showToast(`Error saving file: ${error.message}`, 'error');
        }
    }

    /**
     * Save all modified files
     */
    async saveAllFiles() {
        if (this.modifiedFiles.size === 0) {
            UIComponents.showToast('No files to save', 'warning');
            return;
        }

        try {
            const files = Array.from(this.modifiedFiles);
            let saved = 0;

            for (const filePath of files) {
                const fileData = this.openFiles.get(filePath);
                if (fileData && this.currentFile && this.currentFile.path === filePath) {
                    fileData.headers = this.currentHeaders;
                    fileData.rows = this.currentRows;
                    fileData.typeInfo = this.currentTypeInfo;
                }

                if (fileData) {
                    await this._saveFile(fileData.file);
                    saved++;
                }
            }

            this.modifiedFiles.clear();
            this._updateStatus();
            UIComponents.showToast(`✓ All files saved (${saved})`, 'success');
        } catch (error) {
            console.error('Error saving files:', error);
            UIComponents.showToast(`Error saving files: ${error.message}`, 'error');
        }
    }

    /**
     * Save a single file
     * @private
     */
    async _saveFile(file) {
        if (!file.fileHandle) {
            throw new Error('File handle not available');
        }

        // Get file data to save
        let headersToSave = this.currentHeaders;
        let rowsToSave = this.currentRows;

        if (file.path !== this.currentFile?.path) {
            const fileData = this.openFiles.get(file.path);
            if (fileData) {
                headersToSave = fileData.headers;
                rowsToSave = fileData.rows;
            }
        }

        // Serialize to CSV
        const csvContent = CSVParser.serialize(headersToSave, rowsToSave);

        // Write to file
        const writable = await file.fileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();
    }

    /**
     * Toggle between form and table view in inspector
     * @private
     */
    _toggleInspectorView() {
        this.dataInspector.toggleViewMode();
        this._updateInspectorViewButtonText();
    }

    /**
     * Update inspector view toggle button text
     * @private
     */
    _updateInspectorViewButtonText() {
        const viewToggleBtn = document.getElementById('inspectorViewToggle');
        const currentMode = this.dataInspector.getViewMode();
        viewToggleBtn.textContent = currentMode === 'form' ? 'Table View' : 'Form View';
    }

    /**
     * Setup keyboard shortcuts
     * @private
     */
    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();

                if (e.shiftKey) {
                    this.saveAllFiles();
                } else {
                    this.saveCurrentFile();
                }
            }
        });
    }

    /**
     * Auto-select a row when file is loaded
     * Restores previous selection if available, otherwise selects first row
     * @param {string} filePath - Path to the file
     * @param {Array} rows - Array of row objects
     * @param {string} idColumn - ID column name
     * @private
     */
    _autoSelectRow(filePath, rows, idColumn) {
        if (rows.length === 0) {
            return;
        }

        // Check if we have a saved selection for this file
        const savedRowId = this.selectionHistory.get(filePath);
        if (savedRowId) {
            // Try to restore the saved selection
            const rowExists = rows.some(row => row[idColumn] === savedRowId);
            if (rowExists) {
                this.rowList.selectRowById(savedRowId, true);
                return;
            }
        }

        // Default: select the first row
        this.rowList.selectRowByIndex(0, true);
    }

    /**
     * Save current row selection to history
     * @param {string} filePath - Path to the file
     * @param {Array} selectedIds - Array of selected row IDs
     * @private
     */
    _saveSelectionToHistory(filePath, selectedIds) {
        if (selectedIds.length > 0) {
            // Save the first selected row ID (single selection focus)
            this.selectionHistory.set(filePath, selectedIds[0]);
            this._persistSelectionHistory();
        }
    }

    /**
     * Load selection history from localStorage
     * @returns {Map} Map of file path -> row ID
     * @private
     */
    _loadSelectionHistory() {
        try {
            const stored = localStorage.getItem('dataEditor_selectionHistory');
            if (stored) {
                return new Map(JSON.parse(stored));
            }
        } catch (error) {
            console.warn('Could not load selection history:', error);
        }
        return new Map();
    }

    /**
     * Persist selection history to localStorage
     * @private
     */
    _persistSelectionHistory() {
        try {
            const data = Array.from(this.selectionHistory.entries());
            localStorage.setItem('dataEditor_selectionHistory', JSON.stringify(data));
        } catch (error) {
            console.warn('Could not persist selection history:', error);
        }
    }

    /**
     * Handle add column button click
     * @private
     */
    async _onAddColumnClicked() {
        if (!this.currentFile) {
            UIComponents.showToast('No file selected', 'warning');
            return;
        }

        const result = await UIComponents.showAddHeaderModal(this.currentHeaders);
        if (result) {
            this._addHeader(result.name, result.type);
        }
    }

    /**
     * Handle add row button click
     * @private
     */
    _onAddRowClicked() {
        if (!this.currentFile) {
            UIComponents.showToast('No file selected', 'warning');
            return;
        }

        // Find the next available "New Data N" name
        let newId = 'New Data 1';
        let counter = 1;
        while (this.currentRows.some(row => row[this.currentIdColumn] === newId)) {
            counter++;
            newId = `New Data ${counter}`;
        }

        // Create new row with default values
        const newRow = {};
        this.currentHeaders.forEach(header => {
            newRow[header] = '';
        });
        newRow[this.currentIdColumn] = newId;

        // Add row to data
        this.currentRows.push(newRow);

        // Mark file as modified
        if (!this.modifiedFiles.has(this.currentFile.path)) {
            this.modifiedFiles.add(this.currentFile.path);
        }

        // Update cache
        this.openFiles.set(this.currentFile.path, {
            file: this.currentFile,
            headers: this.currentHeaders,
            rows: this.currentRows,
            idColumn: this.currentIdColumn,
            typeInfo: this.currentTypeInfo
        });

        // Update UI
        this._updateStatus();
        this.rowList.loadRows(this.currentRows, this.currentIdColumn, this.currentHeaders);

        // Auto-select the new row
        this.rowList.selectRowById(newId, true);

        UIComponents.showToast(`✓ New row "${newId}" added`, 'success');
    }

    /**
     * Handle delete row button click
     * @private
     */
    async _onDeleteRowClicked() {
        const selectedIndices = this.dataInspector.selectedIndices;
        if (selectedIndices.length === 0) {
            UIComponents.showToast('No rows selected', 'warning');
            return;
        }

        const selectedRows = CSVParser.getRowsByIndices(this.currentRows, selectedIndices);
        const selectedIds = selectedRows.map(row => row[this.currentIdColumn]);

        const message = selectedIndices.length === 1
            ? `Delete row "${selectedIds[0]}"?`
            : `Delete ${selectedIndices.length} rows?`;

        const confirmed = await UIComponents.showConfirm('Confirm Delete', message);
        if (!confirmed) {
            return;
        }

        // Remove selected rows (filter out rows that are at the selected indices)
        const indicesToDelete = new Set(selectedIndices);
        this.currentRows = this.currentRows.filter((_, index) =>
            !indicesToDelete.has(index)
        );

        // Mark file as modified
        if (!this.modifiedFiles.has(this.currentFile.path)) {
            this.modifiedFiles.add(this.currentFile.path);
        }

        // Update cache
        this.openFiles.set(this.currentFile.path, {
            file: this.currentFile,
            headers: this.currentHeaders,
            rows: this.currentRows,
            idColumn: this.currentIdColumn,
            typeInfo: this.currentTypeInfo
        });

        // Update UI
        this._updateStatus();
        this.rowList.loadRows(this.currentRows, this.currentIdColumn, this.currentHeaders);
        this.dataInspector.clear();

        UIComponents.showToast(`✓ ${selectedIds.length} row${selectedIds.length !== 1 ? 's' : ''} deleted`, 'success');
    }

    /**
     * Add a new header/column to the current CSV
     * @param {string} headerName - Name of the new column
     * @param {string} dataType - Data type: 'string', 'number', 'enum', 'json'
     * @private
     */
    _addHeader(headerName, dataType) {
        // Add header
        this.currentHeaders.push(headerName);

        // Initialize all rows with default value based on type
        let defaultValue = '';
        if (dataType === 'number') {
            defaultValue = '0';
        } else if (dataType === 'json') {
            defaultValue = '{}';
        } else if (dataType === 'enum') {
            defaultValue = '';
        }

        this.currentRows.forEach(row => {
            row[headerName] = defaultValue;
        });

        // Update type info
        if (dataType === 'enum') {
            this.currentTypeInfo[headerName] = { type: 'enum', options: [] };
        } else {
            this.currentTypeInfo[headerName] = { type: dataType };
        }

        // Mark file as modified
        if (this.currentFile && !this.modifiedFiles.has(this.currentFile.path)) {
            this.modifiedFiles.add(this.currentFile.path);
        }

        // Update cache
        if (this.currentFile) {
            this.openFiles.set(this.currentFile.path, {
                file: this.currentFile,
                headers: this.currentHeaders,
                rows: this.currentRows,
                idColumn: this.currentIdColumn,
                typeInfo: this.currentTypeInfo
            });
        }

        // Reload UI
        this._updateStatus();
        this.rowList.loadRows(this.currentRows, this.currentIdColumn, this.currentHeaders);
        this.dataInspector.load(
            this.currentHeaders,
            this.currentRows,
            this.currentIdColumn,
            this.dataInspector.selectedIds,
            this.currentTypeInfo
        );

        UIComponents.showToast(`✓ Column "${headerName}" added`, 'success');
    }

    /**
     * Save last viewed file path to localStorage
     * @param {string} filePath - Path to the file
     * @private
     */
    _saveLastViewedFilePath(filePath) {
        try {
            localStorage.setItem('dataEditor_lastViewedFilePath', filePath);
        } catch (error) {
            console.warn('Could not save last viewed file path:', error);
        }
    }

    /**
     * Load last viewed file path from localStorage
     * @returns {string|null} Last viewed file path or null
     * @private
     */
    _loadLastViewedFilePath() {
        try {
            return localStorage.getItem('dataEditor_lastViewedFilePath') || null;
        } catch (error) {
            console.warn('Could not load last viewed file path:', error);
            return null;
        }
    }

    /**
     * Log browser support information to console and update UI indicator
     * @private
     */
    _logBrowserSupport() {
        if (!this.persistence) return;

        const support = this.persistence.getBrowserSupport();
        console.log('EditorPersistence - Browser Support:');
        console.log('  File System Access API:', support.fileSystemAccess);
        console.log('  IndexedDB:', support.indexedDB);
        console.log('  localStorage:', support.localStorage);
        console.log('  Directory Persistence:', support.supportsDirectoryPersistence ? '✓ Enabled' : '✗ Limited');
        console.log('  Fallback Available:', support.fallbackAvailable ? '✓ Yes' : '✗ No');

        // Update support indicator
        this._updateSupportIndicator(support);
    }

    /**
     * Update the visual support indicator in the header
     * @param {Object} support - Support info from persistence module
     * @private
     */
    _updateSupportIndicator(support) {
        const indicator = document.getElementById('supportIndicator');
        if (!indicator) return;

        let status = 'unsupported';
        let title = 'Browser support: Limited\n\nUnsupported features:\n';
        let unsupported = [];

        if (!support.fileSystemAccess) {
            unsupported.push('File System Access API');
        }
        if (!support.indexedDB) {
            unsupported.push('IndexedDB');
        }
        if (!support.localStorage) {
            unsupported.push('localStorage');
        }

        if (unsupported.length === 0) {
            status = 'supported';
            title = 'Browser support: Full\n\n✓ Persistent directory access enabled\n✓ All features available';
        } else if (support.fallbackAvailable) {
            status = 'partial';
            title = 'Browser support: Partial\n\nUnsupported:\n• ' + unsupported.join('\n• ') +
                    '\n\n⚠ Directory persistence limited (fallback available)';
        } else {
            status = 'unsupported';
            title = 'Browser support: Unsupported\n\nUnsupported:\n• ' + unsupported.join('\n• ') +
                    '\n\n✗ Persistent directory access not available';
        }

        // Set indicator appearance
        indicator.className = `support-indicator ${status}`;
        indicator.title = title;

        // Set indicator text
        if (status === 'supported') {
            indicator.textContent = '✓';
        } else if (status === 'partial') {
            indicator.textContent = '⚠';
        } else {
            indicator.textContent = '✗';
        }
    }

    /**
     * Try to auto-load the last used folder on startup
     * Detects if a stored folder exists but permissions were revoked,
     * and prompts user to restore access
     * @private
     */
    async _tryAutoLoadFolder() {
        if (!this.persistence) return;

        try {
            // First, try to get an already-valid handle
            let handle = await this.persistence.getDirectoryHandle();
            if (handle) {
                console.log('EditorPersistence: Auto-loading last folder:', handle.name);
                this.fileExplorer.dirHandle = handle;
                await this.fileExplorer.loadDirectory();
                return;
            }

            // Check if a stored handle exists but permissions were revoked
            const hasStored = await this.persistence.hasStoredHandle();
            if (hasStored) {
                console.log('EditorPersistence: Stored folder found but permission revoked - prompting user to restore');
                // Show a toast with an action to restore permissions
                UIComponents.showToast(
                    'Your saved folder access expired. Grant permission to restore access.',
                    'warning',
                    {
                        label: 'Restore',
                        action: () => this._restoreStoredFolderAccess()
                    }
                );
            } else {
                console.log('EditorPersistence: No stored folder to auto-load');
            }
        } catch (error) {
            console.warn('EditorPersistence: Could not auto-load folder:', error);
            // Clear invalid stored data
            try {
                await this.persistence.clearAll();
                UIComponents.showToast('Stored folder access expired. Please select your data directory again.', 'warning');
            } catch (e) {
                // Ignore
            }
        }
    }

    /**
     * Restore access to a previously saved folder
     * Requests permission from the user for the stored folder handle
     * This must be called with user activation (e.g., from a button click)
     * @private
     */
    async _restoreStoredFolderAccess() {
        if (!this.persistence) return;

        try {
            console.log('EditorPersistence: User requesting permission restoration...');
            const handle = await this.persistence.restoreDirectoryHandleWithPermission();

            if (handle) {
                console.log('EditorPersistence: Successfully restored folder access:', handle.name);
                this.fileExplorer.dirHandle = handle;
                await this.fileExplorer.loadDirectory();
                UIComponents.showToast('✓ Folder access restored successfully', 'success');
            } else {
                console.warn('EditorPersistence: Failed to restore folder access');
                UIComponents.showToast('Could not restore folder access. Please select the directory manually.', 'error');
            }
        } catch (error) {
            console.error('EditorPersistence: Error restoring folder access:', error);
            UIComponents.showToast('Error restoring folder access. Please select the directory manually.', 'error');
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new DataEditor();
    app.init();
});
