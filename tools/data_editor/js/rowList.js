/**
 * Row List Module
 * Manages the middle pane ID list with multi-select functionality
 */

class RowList {
    constructor(container, searchContainer) {
        this.container = container;
        this.searchContainer = searchContainer;
        this.searchInput = searchContainer.querySelector('input');
        this.ids = [];
        this.selectedIndices = new Set();
        this.lastSelectedIndex = null;
        this.onSelectionChanged = null;
        this.rows = [];
        this.idColumn = null;
        this.headers = [];
        this.displayColumnCount = 1; // Number of columns to display for labels

        this._setupSearch();
    }

    /**
     * Load rows from CSV data
     * @param {Array} rows - CSV row objects
     * @param {string} idColumn - Name of ID column
     * @param {Array} headers - Column headers
     */
    loadRows(rows, idColumn, headers = []) {
        this.rows = rows;
        this.idColumn = idColumn;
        this.headers = headers;
        this.ids = CSVParser.extractIds(rows, idColumn);
        this.selectedIndices.clear();
        this.lastSelectedIndex = null;

        // Determine how many columns to display for unique row identification
        this._determineDisplayColumnCount();

        this.render();
    }

    /**
     * Determine how many columns are needed to uniquely identify rows
     * @private
     */
    _determineDisplayColumnCount() {
        if (this.rows.length === 0 || this.headers.length === 0) {
            this.displayColumnCount = 1;
            return;
        }

        // Start with 1 column and increase until all visible labels are unique
        for (let colCount = 1; colCount <= this.headers.length; colCount++) {
            const labels = this.rows.map(row => this._generateRowLabel(row, colCount));
            const uniqueLabels = new Set(labels);

            if (uniqueLabels.size === this.rows.length) {
                this.displayColumnCount = colCount;
                return;
            }
        }

        // Fallback: use all columns
        this.displayColumnCount = this.headers.length;
    }

    /**
     * Generate a label for a row using the specified number of columns
     * @param {Object} row - Row object
     * @param {number} columnCount - Number of columns to include
     * @returns {string} Label for the row
     * @private
     */
    _generateRowLabel(row, columnCount) {
        const parts = [];
        for (let i = 0; i < Math.min(columnCount, this.headers.length); i++) {
            const header = this.headers[i];
            const value = row[header] || '';
            parts.push(String(value));
        }
        return parts.join(' • ');
    }

    /**
     * Render the row list
     */
    render() {
        this.container.innerHTML = '';

        if (this.rows.length === 0) {
            this.container.innerHTML = '<p class="placeholder">No rows found</p>';
            this.searchContainer.style.display = 'none';
            return;
        }

        this.searchContainer.style.display = 'flex';

        // Create row items
        this.rows.forEach((row, index) => {
            const item = document.createElement('div');
            item.className = 'row-item';
            if (this.selectedIndices.has(index)) {
                item.classList.add('selected');
            }

            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'row-checkbox';
            checkbox.checked = this.selectedIndices.has(index);

            // Label
            const label = document.createElement('span');
            label.textContent = this._generateRowLabel(row, this.displayColumnCount);

            item.appendChild(checkbox);
            item.appendChild(label);

            // Event listeners
            item.addEventListener('click', (e) => {
                this._handleRowClick(e, index, item);
            });

            this.container.appendChild(item);
        });

        this._updateRowCount();
    }

    /**
     * Handle row click with multi-select support
     * @private
     */
    _handleRowClick(event, index) {
        const isCheckboxClick = event.target.classList.contains('row-checkbox');
        const isCtrlClick = event.ctrlKey || event.metaKey;
        const isShiftClick = event.shiftKey;

        if (isShiftClick && this.lastSelectedIndex !== null) {
            // Select range from last selected to current
            this._selectRange(this.lastSelectedIndex, index);
        } else if (isCtrlClick || isCheckboxClick) {
            // Toggle selection
            this._toggleSelection(index);
        } else {
            // Single select
            this.selectedIndices.clear();
            this._addSelection(index);
        }

        this.lastSelectedIndex = index;
        this.render();
        this._notifySelectionChanged();
    }

    /**
     * Select a range of rows by index
     * @private
     */
    _selectRange(startIndex, endIndex) {
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);

        for (let i = min; i <= max; i++) {
            this._addSelection(i);
        }
    }

    /**
     * Add row index to selection
     * @private
     */
    _addSelection(index) {
        this.selectedIndices.add(index);
    }

    /**
     * Remove row index from selection
     * @private
     */
    _removeSelection(index) {
        this.selectedIndices.delete(index);
    }

    /**
     * Toggle selection for row index
     * @private
     */
    _toggleSelection(index) {
        if (this.selectedIndices.has(index)) {
            this._removeSelection(index);
        } else {
            this._addSelection(index);
        }
    }

    /**
     * Get selected IDs (mapped from selected indices)
     * @returns {Array} Array of selected ID values
     */
    getSelectedIds() {
        return Array.from(this.selectedIndices).map(index => this.rows[index][this.idColumn]);
    }

    /**
     * Get selected row indices
     * @returns {Array} Array of selected row indices (in order)
     */
    getSelectedIndices() {
        return Array.from(this.selectedIndices).sort((a, b) => a - b);
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedIndices.clear();
        this.lastSelectedIndex = null;
        this.render();
    }

    /**
     * Setup search input
     * @private
     */
    _setupSearch() {
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this._filterRows(query);
        });
    }

    /**
     * Filter rows by search query
     * @private
     */
    _filterRows(query) {
        const items = this.container.querySelectorAll('.row-item');

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? '' : 'none';
        });
    }

    /**
     * Update row count display
     * @private
     */
    _updateRowCount() {
        let countText = `${this.rows.length} row${this.rows.length !== 1 ? 's' : ''}`;

        if (this.selectedIndices.size > 0) {
            countText += ` • ${this.selectedIndices.size} selected`;
        }

        // Create or update count element
        let countEl = this.container.parentElement.querySelector('.row-count');
        if (!countEl) {
            countEl = document.createElement('div');
            countEl.className = 'row-count';
            this.container.parentElement.appendChild(countEl);
        }

        countEl.textContent = countText;
    }

    /**
     * Notify listeners of selection change
     * @private
     */
    _notifySelectionChanged() {
        if (this.onSelectionChanged) {
            this.onSelectionChanged(this.getSelectedIds());
        }
    }

    /**
     * Select a specific row by index
     * @param {number} index - Row index to select
     * @param {boolean} triggerCallback - Whether to trigger selection change callback
     */
    selectRowByIndex(index, triggerCallback = true) {
        if (index < 0 || index >= this.rows.length) {
            return;
        }

        this.selectedIndices.clear();
        this._addSelection(index);
        this.lastSelectedIndex = index;
        this.render();

        if (triggerCallback) {
            this._notifySelectionChanged();
        }
    }

    /**
     * Select a specific row by ID
     * @param {string} id - Row ID to select
     * @param {boolean} triggerCallback - Whether to trigger selection change callback
     */
    selectRowById(id, triggerCallback = true) {
        const index = this.rows.findIndex(row => row[this.idColumn] === id);
        if (index !== -1) {
            this.selectRowByIndex(index, triggerCallback);
        }
    }

    /**
     * Clear the list
     */
    clear() {
        this.ids = [];
        this.selectedIndices.clear();
        this.rows = [];
        this.idColumn = null;
        this.lastSelectedIndex = null;
        this.headers = [];
        this.displayColumnCount = 1;
        this.render();
        this.searchContainer.style.display = 'none';
        this.searchInput.value = '';
    }
}
