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

        // Check if all values are numeric (most specific type, check first)
        if (this._areAllNumeric(nonEmpty)) {
            return { type: 'number' };
        }

        // Check if all values are valid JSON (more specific than enum)
        if (this._areAllJSON(nonEmpty)) {
            const subtype = this._inferJSONSubtype(nonEmpty);
            return { type: 'json', subtype: subtype };
        }

        // Check if most values are valid JSON (fallback for mixed content)
        if (this._areMostlyJSON(nonEmpty, 0.75)) {
            const validJsonValues = nonEmpty.filter(v => this._isValidJSON(v));
            const subtype = this._inferJSONSubtype(validJsonValues);
            return { type: 'json', subtype: subtype };
        }

        // Check for enum (repeated values) - after JSON since it's more general
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
     * Check if most values are valid JSON (threshold-based)
     * @param {Array} values - Non-empty values to check
     * @param {number} threshold - Percentage threshold (0-1), default 0.75 (75%)
     * @private
     */
    static _areMostlyJSON(values, threshold = 0.75) {
        if (values.length === 0) return false;

        const validCount = values.filter(value => this._isValidJSON(value)).length;
        const percentage = validCount / values.length;
        return percentage >= threshold;
    }

    /**
     * Infer JSON subtype (collection vs dictionary)
     * Collections: Arrays with consistent object schema (same keys across all items)
     * Dictionaries: Objects with varying keys or heterogeneous arrays
     * @param {Array} values - Non-empty values (all valid JSON)
     * @returns {string} 'json_collection' | 'json_dictionary'
     * @private
     */
    static _inferJSONSubtype(values) {
        if (values.length === 0) return 'json_dictionary';

        // Parse all values
        const parsed = [];
        for (const value of values) {
            try {
                const obj = typeof value === 'string' ? JSON.parse(value) : value;
                parsed.push(obj);
            } catch {
                // Skip invalid JSON
            }
        }

        if (parsed.length === 0) return 'json_dictionary';

        // Check if ANY value is a collection (array with consistent object schema)
        // Per requirement: "If any row in a column is identified as JSON Collection,
        // define that column's type as JSON Collection"
        let hasCollection = false;
        let hasDictionary = false;

        for (const item of parsed) {
            if (Array.isArray(item)) {
                // Check if array contains objects with consistent schema
                if (this._isArrayCollection(item)) {
                    hasCollection = true;
                } else {
                    hasDictionary = true;
                }
            } else if (typeof item === 'object' && item !== null) {
                // Single objects are dictionaries
                hasDictionary = true;
            }
        }

        // Conflict resolution: If mixed, prioritize dictionary
        if (hasCollection && hasDictionary) {
            return 'json_dictionary';
        }

        // If any row is a collection, treat column as collection
        if (hasCollection) {
            return 'json_collection';
        }

        // Default to dictionary
        return 'json_dictionary';
    }

    /**
     * Check if an array is a collection (objects with consistent schema)
     * @param {Array} arr - Array to check
     * @returns {boolean}
     * @private
     */
    static _isArrayCollection(arr) {
        if (!Array.isArray(arr) || arr.length === 0) {
            return false;
        }

        // All items must be non-null objects (not arrays)
        const allObjects = arr.every(
            item => typeof item === 'object' && item !== null && !Array.isArray(item)
        );

        if (!allObjects) {
            return false;
        }

        // Check schema consistency: all objects should have the same keys
        const firstKeys = Object.keys(arr[0]).sort();

        return arr.every(item => {
            const itemKeys = Object.keys(item).sort();
            return JSON.stringify(itemKeys) === JSON.stringify(firstKeys);
        });
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
     * Detect vector groups (headers with X, Y, Z suffixes sharing same prefix)
     * @param {Array} headers - Column names
     * @returns {Map} Map of group name to { components: [X, Y, Z] }
     */
    static detectVectorGroups(headers) {
        const vectorMap = new Map();
        const suffixPattern = /(X|Y|Z)$/;

        headers.forEach(header => {
            const match = header.match(suffixPattern);
            if (match) {
                const suffix = match[1];
                const prefix = header.slice(0, -1); // Remove the suffix

                if (!vectorMap.has(prefix)) {
                    vectorMap.set(prefix, { components: [] });
                }

                vectorMap.get(prefix).components.push({ suffix, header });
            }
        });

        // Only keep groups that have at least 2 components (X+Y or X+Y+Z)
        const validGroups = new Map();
        vectorMap.forEach((group, prefix) => {
            if (group.components.length >= 2) {
                // Sort components (X, then Y, then Z)
                group.components.sort((a, b) => {
                    const order = { X: 0, Y: 1, Z: 2 };
                    return order[a.suffix] - order[b.suffix];
                });
                validGroups.set(prefix, group);
            }
        });

        return validGroups;
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
