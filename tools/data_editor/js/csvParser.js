/**
 * CSV Parser Module
 * Handles parsing CSV files and serializing data back to CSV format
 */

class CSVParser {
    /**
     * Parse CSV text content
     * @param {string} csvText - Raw CSV content
     * @returns {Object} { headers: Array, rows: Array }
     */
    static parse(csvText) {
        // Use PapaParse for robust CSV parsing
        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false // Keep everything as strings initially
        });

        if (result.errors.length > 0) {
            console.warn('CSV parsing warnings:', result.errors);
        }

        // Extract headers and rows
        const headers = result.meta.fields || [];
        const rows = result.data || [];

        return { headers, rows };
    }

    /**
     * Serialize data back to CSV format
     * @param {Array} headers - Column names
     * @param {Array} rows - Row objects
     * @returns {string} CSV formatted text
     */
    static serialize(headers, rows) {
        const csvLines = [];

        // Add header row
        csvLines.push(headers.join(','));

        // Add data rows
        rows.forEach(row => {
            const values = headers.map(header => {
                const value = row[header] ?? '';

                // Handle JSON values
                if (typeof value === 'object') {
                    const jsonStr = JSON.stringify(value);
                    // Escape quotes by doubling them
                    return jsonStr.replace(/"/g, '""');
                }

                // Convert to string
                const strValue = String(value);

                // Escape values containing commas, quotes, or newlines
                if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                    return `"${strValue.replace(/"/g, '""')}"`;
                }

                return strValue;
            });

            csvLines.push(values.join(','));
        });

        return csvLines.join('\n');
    }

    /**
     * Get ID column name from headers
     * Returns 'id' if it exists (case-insensitive), otherwise returns first header
     * @param {Array} headers - Column names
     * @returns {string} ID column name
     */
    static getIdColumn(headers) {
        // Look for 'id' column (case-insensitive)
        const idColumn = headers.find(h => h.toLowerCase() === 'id');
        if (idColumn) return idColumn;

        // Fall back to first column
        return headers[0] || null;
    }

    /**
     * Extract ID values from rows
     * @param {Array} rows - Row objects
     * @param {string} idColumn - ID column name
     * @returns {Array} Array of ID values
     */
    static extractIds(rows, idColumn) {
        return rows.map(row => row[idColumn] || '').filter(id => id !== '');
    }

    /**
     * Get specific row by ID
     * @param {Array} rows - Row objects
     * @param {string} idColumn - ID column name
     * @param {string} id - ID value to find
     * @returns {Object|null} Row object or null
     */
    static getRowById(rows, idColumn, id) {
        return rows.find(row => row[idColumn] === id) || null;
    }

    /**
     * Update row by ID
     * @param {Array} rows - Row objects
     * @param {string} idColumn - ID column name
     * @param {string} id - ID value to find
     * @param {Object} updates - Object with field updates
     * @returns {boolean} True if row was found and updated
     */
    static updateRow(rows, idColumn, id, updates) {
        const row = this.getRowById(rows, idColumn, id);
        if (!row) return false;

        Object.assign(row, updates);
        return true;
    }

    /**
     * Update multiple rows by IDs
     * @param {Array} rows - Row objects
     * @param {string} idColumn - ID column name
     * @param {Array} ids - Array of ID values
     * @param {Object} updates - Object with field updates
     * @returns {number} Number of rows updated
     */
    static updateMultipleRows(rows, idColumn, ids, updates) {
        let count = 0;
        ids.forEach(id => {
            if (this.updateRow(rows, idColumn, id, updates)) {
                count++;
            }
        });
        return count;
    }

    /**
     * Clone a row
     * @param {Object} row - Row object to clone
     * @returns {Object} Deep clone of row
     */
    static cloneRow(row) {
        const cloned = {};
        Object.keys(row).forEach(key => {
            const value = row[key];
            if (typeof value === 'object' && value !== null) {
                cloned[key] = JSON.parse(JSON.stringify(value));
            } else {
                cloned[key] = value;
            }
        });
        return cloned;
    }
}
