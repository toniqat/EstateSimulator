/**
 * JSON Renderer Module
 * Smart table/form rendering for JSON data
 */

class JSONRenderer {
    /**
     * Render JSON data as a table or form
     * @param {any} data - JSON data to render
     * @param {Function} onChange - Callback when data changes
     * @param {string} guessedType - 'object' or 'array' for empty state initialization (optional)
     * @param {Object} typeInfo - Type information with optional subtype ('json_collection' | 'json_dictionary')
     * @param {Object} context - CSV context for schema inference: { rows, columnName, headers }
     * @returns {HTMLElement} Rendered element
     */
    static render(data, onChange, guessedType = 'object', typeInfo = null, context = null) {
        if (data === '' || data === null || data === undefined) {
            return this._renderEmptyState(onChange, guessedType, typeInfo, context);
        }

        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;

            // Use typeInfo.subtype if available to determine rendering strategy
            if (typeInfo && typeInfo.subtype === 'json_collection') {
                // Explicitly render as collection (table with headers)
                if (Array.isArray(parsed)) {
                    return this._renderArray(parsed, onChange);
                }
            }

            // Default rendering based on actual structure
            if (Array.isArray(parsed)) {
                return this._renderArray(parsed, onChange);
            } else if (typeof parsed === 'object') {
                return this._renderObject(parsed, onChange);
            } else {
                return this._renderPrimitive(parsed, onChange);
            }
        } catch (error) {
            return this._renderError(error.message);
        }
    }

    /**
     * Render empty state
     * @param {Function} onChange - Callback when data changes
     * @param {string} guessedType - 'object' or 'array' to pre-initialize empty structure
     * @param {Object} typeInfo - Type information with optional subtype
     * @param {Object} context - CSV context: { rows, columnName, headers }
     * @private
     */
    static _renderEmptyState(onChange, guessedType = 'object', typeInfo = null, context = null) {
        const container = document.createElement('div');
        container.className = 'json-empty-editable';

        // Try to infer schema from other rows in the same column
        const inferredType = this._inferJSONStructureFromContext(context, typeInfo);

        // Render empty table view based on inferred or guessed type
        if (inferredType === 'json_collection') {
            return this._renderEmptyCollection(container, onChange, context);
        } else if (inferredType === 'json_dictionary') {
            return this._renderEmptyDictionary(container, onChange);
        }

        // Fallback to original behavior if can't infer
        return this._renderEmptyFallback(container, onChange, guessedType);
    }

    /**
     * Infer JSON structure from CSV context (other rows in same column)
     * @param {Object} context - CSV context: { rows, columnName, headers }
     * @param {Object} typeInfo - Type information with subtype
     * @returns {string} 'json_collection' | 'json_dictionary' | null
     * @private
     */
    static _inferJSONStructureFromContext(context, typeInfo) {
        // If typeInfo has explicit subtype, use it
        if (typeInfo && typeInfo.subtype) {
            return typeInfo.subtype;
        }

        // Try to infer from context (other rows)
        if (!context || !context.rows || !context.columnName) {
            return null;
        }

        const { rows, columnName } = context;

        // Get all non-empty values in this column
        const nonEmptyValues = [];
        for (const row of rows) {
            const value = row[columnName];
            if (value && value !== '' && value !== null && value !== undefined) {
                try {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                    nonEmptyValues.push(parsed);
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }

        // If no valid JSON found, can't infer
        if (nonEmptyValues.length === 0) {
            return null;
        }

        // Use TypeInference to determine subtype
        return TypeInference._inferJSONSubtype(
            nonEmptyValues.map(v => typeof v === 'string' ? v : JSON.stringify(v))
        );
    }

    /**
     * Render empty JSON collection (array with consistent schema)
     * Shows a table with headers derived from reference rows
     * @private
     */
    static _renderEmptyCollection(container, onChange, context) {
        // Find reference schema from non-empty rows
        const referenceSchema = this._getReferenceCollectionSchema(context);

        if (!referenceSchema || referenceSchema.length === 0) {
            // No reference schema, show empty message
            const msg = document.createElement('p');
            msg.className = 'json-empty-prompt';
            msg.style.cssText = 'color: var(--text-secondary); font-style: italic; margin-bottom: 12px;';
            msg.textContent = 'Empty collection - Click to add rows';
            container.appendChild(msg);

            const addBtn = document.createElement('button');
            addBtn.className = 'json-add-row-btn';
            addBtn.innerHTML = '+ Add Row';
            addBtn.addEventListener('click', () => {
                const newArray = [{}];
                if (onChange) onChange(newArray);
                container.innerHTML = '';
                container.appendChild(this._renderArray(newArray, onChange));
            });
            container.appendChild(addBtn);
            return container;
        }

        // Create table with headers
        const table = document.createElement('table');
        table.className = 'json-table';

        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        referenceSchema.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });

        // Delete column header
        const deleteHeader = document.createElement('th');
        deleteHeader.textContent = '';
        headerRow.appendChild(deleteHeader);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body (initially empty)
        const tbody = document.createElement('tbody');

        // Add Row button
        const addRowTr = document.createElement('tr');
        addRowTr.className = 'json-table-add-row-tr';

        const addRowTd = document.createElement('td');
        addRowTd.colSpan = referenceSchema.length + 1; // +1 for delete button

        const addBtn = document.createElement('button');
        addBtn.className = 'json-add-row-btn';
        addBtn.innerHTML = '+ Add Row';

        addBtn.addEventListener('click', () => {
            const newArray = [{}];
            referenceSchema.forEach(col => {
                newArray[0][col] = '';
            });
            if (onChange) onChange(newArray);
            container.innerHTML = '';
            container.appendChild(this._renderArray(newArray, onChange));
        });

        addRowTd.appendChild(addBtn);
        addRowTr.appendChild(addRowTd);
        tbody.appendChild(addRowTr);

        table.appendChild(tbody);
        container.appendChild(table);

        return container;
    }

    /**
     * Render empty JSON dictionary (object with varying keys)
     * Shows Key-Value list with "+ Add Key" button
     * @private
     */
    static _renderEmptyDictionary(container, onChange) {
        const emptyObject = {};

        const msg = document.createElement('p');
        msg.className = 'json-empty-prompt';
        msg.style.cssText = 'color: var(--text-secondary); font-style: italic; margin-bottom: 12px;';
        msg.textContent = 'Empty dictionary - Click to add keys';
        container.appendChild(msg);

        const addKeyBtn = document.createElement('button');
        addKeyBtn.className = 'json-add-row-btn';
        addKeyBtn.innerHTML = '+ Add Key';
        addKeyBtn.addEventListener('click', () => {
            emptyObject['New Key 1'] = '';
            if (onChange) onChange(emptyObject);
            container.innerHTML = '';
            container.appendChild(this._renderObject(emptyObject, onChange));
        });
        container.appendChild(addKeyBtn);

        return container;
    }

    /**
     * Fallback rendering for when schema can't be inferred
     * @private
     */
    static _renderEmptyFallback(container, onChange, guessedType) {
        // Show prompt
        const prompt = document.createElement('p');
        prompt.className = 'json-empty-prompt';
        prompt.style.cssText = 'color: var(--text-secondary); font-style: italic; margin-bottom: 12px;';
        prompt.textContent = 'No JSON data - Click to add data';
        container.appendChild(prompt);

        // Create empty structure based on guessed type
        if (guessedType === 'array') {
            const emptyArray = [];
            const addBtn = document.createElement('button');
            addBtn.className = 'json-add-row-btn';
            addBtn.innerHTML = '+ Add Row';
            addBtn.addEventListener('click', () => {
                emptyArray.push({});
                if (onChange) onChange(emptyArray);
                container.innerHTML = '';
                container.appendChild(this._renderArray(emptyArray, onChange));
            });
            container.appendChild(addBtn);
        } else {
            const emptyObject = {};
            const addKeyBtn = document.createElement('button');
            addKeyBtn.className = 'json-add-row-btn';
            addKeyBtn.innerHTML = '+ Add Key';
            addKeyBtn.addEventListener('click', () => {
                emptyObject['New Key 1'] = '';
                if (onChange) onChange(emptyObject);
                container.innerHTML = '';
                container.appendChild(this._renderObject(emptyObject, onChange));
            });
            container.appendChild(addKeyBtn);
        }

        return container;
    }

    /**
     * Get reference schema (column names) from non-empty collection rows
     * @param {Object} context - CSV context: { rows, columnName }
     * @returns {Array} Array of column names
     * @private
     */
    static _getReferenceCollectionSchema(context) {
        if (!context || !context.rows || !context.columnName) {
            return [];
        }

        const { rows, columnName } = context;

        // Find first non-empty collection value
        for (const row of rows) {
            const value = row[columnName];
            if (value && value !== '' && value !== null && value !== undefined) {
                try {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const firstItem = parsed[0];
                        if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
                            return Object.keys(firstItem);
                        }
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }

        return [];
    }


    /**
     * Render error state
     * @private
     */
    static _renderError(message) {
        const container = document.createElement('div');
        container.className = 'json-error';
        container.innerHTML = `<div style="color: var(--error-color); padding: 8px; background-color: var(--bg-primary); border-radius: 2px; border: 1px solid var(--error-color);">Invalid JSON: ${message}</div>`;
        return container;
    }

    /**
     * Render array as editable table
     * @private
     */
    static _renderArray(arr, onChange) {
        const container = document.createElement('div');

        if (arr.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Empty array</p>';
            return container;
        }

        // Determine if array contains objects or primitives
        const firstItem = arr[0];
        const isObjectArray = typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem);

        let columns = [];
        if (isObjectArray) {
            columns = Object.keys(firstItem);
        } else {
            columns = ['value'];
        }

        // Create table
        const table = document.createElement('table');
        table.className = 'json-table';

        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });

        // Delete column header
        const deleteHeader = document.createElement('th');
        deleteHeader.textContent = '';
        headerRow.appendChild(deleteHeader);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body rows
        const tbody = document.createElement('tbody');

        arr.forEach((item, index) => {
            const row = document.createElement('tr');

            columns.forEach(col => {
                const td = document.createElement('td');

                // Get value: for primitives, use the item itself; for objects, use item[col]
                let value;
                if (isObjectArray) {
                    value = item[col] ?? '';
                } else {
                    value = item ?? '';
                }

                const input = document.createElement('input');
                input.type = 'text';
                input.value = typeof value === 'object' ? JSON.stringify(value) : value;

                input.addEventListener('change', () => {
                    const newValue = this._parseInputValue(input.value);

                    if (isObjectArray) {
                        arr[index][col] = newValue;
                    } else {
                        arr[index] = newValue;
                    }

                    if (onChange) onChange(arr);
                });

                td.appendChild(input);
                row.appendChild(td);
            });

            // Delete button
            const deleteTd = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'json-delete-btn';
            deleteBtn.textContent = '🗑';
            deleteBtn.title = 'Delete row';

            deleteBtn.addEventListener('click', () => {
                arr.splice(index, 1);
                if (onChange) onChange(arr);
                // Re-render
                container.innerHTML = '';
                container.appendChild(this._renderArray(arr, onChange));
            });

            deleteTd.appendChild(deleteBtn);
            row.appendChild(deleteTd);

            tbody.appendChild(row);
        });

        // Add Row button row (integrated into table)
        const addRowTr = document.createElement('tr');
        addRowTr.className = 'json-table-add-row-tr';

        const addRowTd = document.createElement('td');
        addRowTd.colSpan = columns.length + 1; // +1 for delete button column

        const addBtn = document.createElement('button');
        addBtn.className = 'json-add-row-btn';
        addBtn.innerHTML = '+ Add Row';

        addBtn.addEventListener('click', () => {
            let newItem;
            if (isObjectArray) {
                newItem = {};
                columns.forEach(col => {
                    newItem[col] = '';
                });
            } else {
                newItem = '';
            }
            arr.push(newItem);
            if (onChange) onChange(arr);
            // Re-render
            container.innerHTML = '';
            container.appendChild(this._renderArray(arr, onChange));
        });

        addRowTd.appendChild(addBtn);
        addRowTr.appendChild(addRowTd);
        tbody.appendChild(addRowTr);

        table.appendChild(tbody);
        container.appendChild(table);

        return container;
    }

    /**
     * Render object as table (for consistency with array rendering)
     * @private
     */
    static _renderObject(obj, onChange) {
        const container = document.createElement('div');
        const keys = Object.keys(obj);

        if (keys.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color: var(--text-secondary); font-style: italic; margin-bottom: 12px;';
            emptyMsg.textContent = 'Empty object';
            container.appendChild(emptyMsg);

            const addKeyBtn = document.createElement('button');
            addKeyBtn.className = 'json-add-row-btn';
            addKeyBtn.innerHTML = '+ Add Key';
            addKeyBtn.addEventListener('click', () => {
                // Find the next available "New Key N" name
                let newKeyName = 'New Key 1';
                let counter = 1;
                while (obj.hasOwnProperty(newKeyName)) {
                    counter++;
                    newKeyName = `New Key ${counter}`;
                }

                // Add the new key
                obj[newKeyName] = '';
                if (onChange) onChange(obj);
                // Re-render
                container.innerHTML = '';
                container.appendChild(this._renderObject(obj, onChange));
            });
            container.appendChild(addKeyBtn);
            return container;
        }

        // Create table for object key-value pairs
        const table = document.createElement('table');
        table.className = 'json-table';

        const tbody = document.createElement('tbody');

        keys.forEach((key) => {
            const value = obj[key];
            const row = document.createElement('tr');

            // Key column
            const keyTd = document.createElement('td');
            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.value = key;
            keyInput.className = 'json-table-key-input';

            // Handle key renames: when user changes the key name
            keyInput.addEventListener('change', () => {
                const newKey = keyInput.value.trim();

                // Only proceed if the key actually changed and is not empty
                if (newKey && newKey !== key) {
                    // Check if new key already exists
                    if (obj.hasOwnProperty(newKey)) {
                        // Key already exists, show error and revert
                        keyInput.value = key;
                        alert(`Key "${newKey}" already exists`);
                        return;
                    }

                    // Rename the key: copy value to new key, delete old key
                    obj[newKey] = obj[key];
                    delete obj[key];

                    // Notify about change
                    if (onChange) onChange(obj);

                    // Re-render to reflect the change
                    container.innerHTML = '';
                    container.appendChild(this._renderObject(obj, onChange));
                } else if (newKey === '') {
                    // Empty key name not allowed
                    keyInput.value = key;
                    alert('Key name cannot be empty');
                }
            });

            keyTd.appendChild(keyInput);
            row.appendChild(keyTd);

            // Value column
            const valueTd = document.createElement('td');

            if (Array.isArray(value)) {
                // Nested array - show as button to expand
                const expandBtn = document.createElement('button');
                expandBtn.className = 'json-nested-expand-btn';
                expandBtn.textContent = `Array (${value.length} items)`;
                expandBtn.addEventListener('click', () => {
                    const modal = this._createNestedModal('Array', this._renderArray(value, (newValue) => {
                        obj[key] = newValue;
                        if (onChange) onChange(obj);
                    }));
                    document.body.appendChild(modal);
                });
                valueTd.appendChild(expandBtn);
            } else if (typeof value === 'object' && value !== null) {
                // Nested object - show as button to expand
                const expandBtn = document.createElement('button');
                expandBtn.className = 'json-nested-expand-btn';
                expandBtn.textContent = 'Object';
                expandBtn.addEventListener('click', () => {
                    const modal = this._createNestedModal('Object', this._renderObject(value, (newValue) => {
                        obj[key] = newValue;
                        if (onChange) onChange(obj);
                    }));
                    document.body.appendChild(modal);
                });
                valueTd.appendChild(expandBtn);
            } else {
                // Primitive value
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value ?? '';
                input.addEventListener('change', () => {
                    obj[key] = this._parseInputValue(input.value);
                    if (onChange) onChange(obj);
                });
                valueTd.appendChild(input);
            }

            row.appendChild(valueTd);

            // Delete button
            const deleteTd = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'json-delete-btn';
            deleteBtn.textContent = '🗑';
            deleteBtn.title = 'Delete key';

            deleteBtn.addEventListener('click', () => {
                delete obj[key];
                if (onChange) onChange(obj);
                // Re-render
                container.innerHTML = '';
                container.appendChild(this._renderObject(obj, onChange));
            });

            deleteTd.appendChild(deleteBtn);
            row.appendChild(deleteTd);

            tbody.appendChild(row);
        });

        // Add Row button row
        const addRowTr = document.createElement('tr');
        addRowTr.className = 'json-table-add-row-tr';

        const addRowTd = document.createElement('td');
        addRowTd.colSpan = 3; // Key, Value, Delete button columns

        const addBtn = document.createElement('button');
        addBtn.className = 'json-add-row-btn';
        addBtn.innerHTML = '+ Add Key';

        addBtn.addEventListener('click', () => {
            // Find the next available "New Key N" name
            let newKeyName = 'New Key 1';
            let counter = 1;
            while (obj.hasOwnProperty(newKeyName)) {
                counter++;
                newKeyName = `New Key ${counter}`;
            }

            // Add the new key
            obj[newKeyName] = '';
            if (onChange) onChange(obj);
            // Re-render
            container.innerHTML = '';
            container.appendChild(this._renderObject(obj, onChange));
        });

        addRowTd.appendChild(addBtn);
        addRowTr.appendChild(addRowTd);
        tbody.appendChild(addRowTr);

        table.appendChild(tbody);
        container.appendChild(table);

        return container;
    }

    /**
     * Create a modal dialog for nested objects/arrays
     * @private
     */
    static _createNestedModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'json-nested-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'json-nested-modal';
        modalContent.style.cssText = `
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 16px;
            max-width: 80vw;
            max-height: 80vh;
            overflow: auto;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

        const modalHeader = document.createElement('div');
        modalHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

        const modalTitle = document.createElement('h3');
        modalTitle.style.cssText = 'margin: 0;';
        modalTitle.textContent = title;
        modalHeader.appendChild(modalTitle);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary);';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        modalHeader.appendChild(closeBtn);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(content);

        modal.appendChild(modalContent);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        return modal;
    }

    /**
     * Render primitive value
     * @private
     */
    static _renderPrimitive(value, onChange) {
        const container = document.createElement('div');

        const input = document.createElement('input');
        input.className = 'inspector-field-input';
        input.type = 'text';
        input.value = String(value);

        input.addEventListener('change', () => {
            if (onChange) onChange(this._parseInputValue(input.value));
        });

        container.appendChild(input);
        return container;
    }

    /**
     * Parse input value intelligently
     * @private
     */
    static _parseInputValue(value) {
        if (value === '') return '';
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    /**
     * Serialize JSON data back to string
     * @param {any} data - Data to serialize
     * @returns {string} JSON string
     */
    static serialize(data) {
        if (data === '' || data === null || data === undefined) {
            return '';
        }
        return JSON.stringify(data);
    }
}
