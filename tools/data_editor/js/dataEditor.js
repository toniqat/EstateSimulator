/**
 * Main Data Editor Application Controller
 * Orchestrates all modules and manages application state
 */

class DataEditor {
    constructor() {
        this.fileExplorer = null;
        this.rowList = null;
        this.dataInspector = null;

        this.currentFile = null;
        this.currentHeaders = [];
        this.currentRows = [];
        this.currentIdColumn = null;
        this.currentTypeInfo = {};

        this.modifiedFiles = new Set();
        this.openFiles = new Map(); // Map of path -> { headers, rows, idColumn }

        // Selection history: Map of file path -> row ID
        this.selectionHistory = this._loadSelectionHistory();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize components
            this._setupComponents();

            // Setup keyboard shortcuts
            this._setupKeyboardShortcuts();

            // Initialize file explorer
            const openDirBtn = document.getElementById('openDirBtn');
            openDirBtn.addEventListener('click', () => {
                this.fileExplorer.init();
            });

            // Update button text based on last used directory
            this._updateOpenDirButtonText();

            UIComponents.updateStatus('Ready. Click "Open Data Directory" to get started.');
        } catch (error) {
            console.error('Failed to initialize:', error);
            UIComponents.showToast('Failed to initialize application', 'error');
        }
    }

    /**
     * Update "Open Data Directory" button text with last used path if available
     * @private
     */
    _updateOpenDirButtonText() {
        const openDirBtn = document.getElementById('openDirBtn');
        if (this.fileExplorer.lastDirPath) {
            openDirBtn.title = `Last used: ${this.fileExplorer.lastDirPath}`;
        }
    }

    /**
     * Setup all components
     * @private
     */
    _setupComponents() {
        // File Explorer
        const fileTreeContainer = document.getElementById('fileTree');
        this.fileExplorer = new FileExplorer(fileTreeContainer);
        this.fileExplorer.onFileSelected = (file) => this._onFileSelected(file);

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
    }

    /**
     * Handle file selection from file explorer
     * @private
     */
    async _onFileSelected(file) {
        try {
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
            this.openFiles.set(file.path, { headers, rows, idColumn });

            // Update UI
            this._updateStatus();
            this.rowList.loadRows(rows, idColumn, headers);
            this.dataInspector.clear();

            // Auto-select row: restore previous selection or select first row
            this._autoSelectRow(file.path, rows, idColumn);

            UIComponents.updateStatus(`Loaded ${file.name} (${rows.length} rows)`);
        } catch (error) {
            console.error('Error loading file:', error);
            UIComponents.showToast(`Error loading file: ${error.message}`, 'error');
        }
    }

    /**
     * Handle row selection change
     * @private
     */
    _onRowSelectionChanged(selectedIds) {
        this.dataInspector.load(
            this.currentHeaders,
            this.currentRows,
            this.currentIdColumn,
            selectedIds,
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
                }

                if (fileData) {
                    await this._saveFile({
                        path: filePath,
                        name: this.currentFile?.name || filePath,
                        handle: this.currentFile?.fileHandle
                    });
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
        if (!file.handle) {
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
        const writable = await file.handle.createWritable();
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
                headers: this.currentHeaders,
                rows: this.currentRows,
                idColumn: this.currentIdColumn
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
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new DataEditor();
    app.init();
});
