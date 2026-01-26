/**
 * Type Inference Engine
 * Analyzes CSV column values to determine the best input type
 */

class TypeInference {
    /**
     * Infer type for a single column
     * @param {string} columnName - Name of the column
     * @param {Array} values - All values in the column
     * @returns {Object} { type, options?, pattern? }
     */
    static inferColumnType(columnName, values) {
        // Filter out empty values for analysis
        const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);

        // If all values are empty, default to string
        if (nonEmpty.length === 0) {
            return { type: 'string' };
        }

        // Check if all values are valid JSON
        if (this._areAllJSON(nonEmpty)) {
            return { type: 'json' };
        }

        // Check if all values are numeric
        if (this._areAllNumeric(nonEmpty)) {
            return { type: 'number' };
        }

        // Check for enum (repeated values)
        const enumResult = this._checkEnum(nonEmpty);
        if (enumResult) {
            return enumResult;
        }

        // Default to string
        return { type: 'string' };
    }

    /**
     * Infer types for all columns in a dataset
     * @param {Array} headers - Column names
     * @param {Array} rows - Row objects
     * @returns {Object} Map of column name to type info
     */
    static inferAllTypes(headers, rows) {
        const types = {};

        headers.forEach(header => {
            const values = rows.map(row => row[header] || '');
            types[header] = this.inferColumnType(header, values);
        });

        return types;
    }

    /**
     * Check if all non-empty values are valid JSON
     * @private
     */
    static _areAllJSON(values) {
        if (values.length === 0) return false;

        return values.every(value => this._isValidJSON(value));
    }

    /**
     * Check if a string is valid JSON
     * @private
     */
    static _isValidJSON(str) {
        if (typeof str !== 'string') return false;
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if all non-empty values are numeric
     * @private
     */
    static _areAllNumeric(values) {
        if (values.length === 0) return false;

        return values.every(value => {
            const str = String(value).trim();
            return /^\d+$/.test(str);
        });
    }

    /**
     * Check if column is an enum (repeated values)
     * @private
     */
    static _checkEnum(values) {
        const uniqueValues = new Set(values);
        const uniqueCount = uniqueValues.size;
        const totalCount = values.length;

        // Enum if: has repeated values AND reasonable number of unique values
        if (uniqueCount < totalCount && uniqueCount <= 20) {
            return {
                type: 'enum',
                options: Array.from(uniqueValues).sort()
            };
        }

        return null;
    }

    /**
     * Parse a value based on its inferred type
     * @param {string} value - Raw string value
     * @param {Object} typeInfo - Type information from inferColumnType
     * @returns {any} Parsed value
     */
    static parseValue(value, typeInfo) {
        if (value === '' || value === null || value === undefined) {
            return '';
        }

        switch (typeInfo.type) {
            case 'number':
                return parseInt(String(value), 10) || 0;
            case 'json':
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            case 'enum':
            case 'string':
            default:
                return String(value);
        }
    }

    /**
     * Serialize a value back to string for CSV
     * @param {any} value - Parsed value
     * @param {Object} typeInfo - Type information
     * @returns {string} String representation for CSV
     */
    static serializeValue(value, typeInfo) {
        if (value === '' || value === null || value === undefined) {
            return '';
        }

        switch (typeInfo.type) {
            case 'json':
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return String(value);
            case 'number':
                return String(parseInt(value, 10) || 0);
            case 'enum':
            case 'string':
            default:
                return String(value);
        }
    }

    /**
     * Get input element type for form rendering
     * @param {Object} typeInfo - Type information
     * @returns {string} HTML input type or 'select'
     */
    static getInputType(typeInfo) {
        switch (typeInfo.type) {
            case 'number':
                return 'number';
            case 'enum':
                return 'select';
            case 'json':
                return 'json';
            case 'string':
            default:
                return 'text';
        }
    }
}
