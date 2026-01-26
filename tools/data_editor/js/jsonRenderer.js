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
     * @returns {HTMLElement} Rendered element
     */
    static render(data, onChange, guessedType = 'object', typeInfo = null) {
        if (data === '' || data === null || data === undefined) {
            return this._renderEmptyState(onChange, guessedType, typeInfo);
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
     * @private
     */
    static _renderEmptyState(onChange, guessedType = 'object', typeInfo = null) {
        const container = document.createElement('div');
        container.className = 'json-empty-editable';

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
                // Re-render
                container.innerHTML = '';
                container.appendChild(this._renderArray(emptyArray, onChange));
            });
            container.appendChild(addBtn);
        } else {
            // Default to object
            const emptyObject = {};
            const addKeyBtn = document.createElement('button');
            addKeyBtn.className = 'json-add-row-btn';
            addKeyBtn.innerHTML = '+ Add Key';
            addKeyBtn.addEventListener('click', () => {
                // Find the next available "New Key N" name
                let newKeyName = 'New Key 1';
                let counter = 1;
                while (emptyObject.hasOwnProperty(newKeyName)) {
                    counter++;
                    newKeyName = `New Key ${counter}`;
                }

                // Add the new key
                emptyObject[newKeyName] = '';
                if (onChange) onChange(emptyObject);
                // Re-render
                container.innerHTML = '';
                container.appendChild(this._renderObject(emptyObject, onChange));
            });
            container.appendChild(addKeyBtn);
        }

        return container;
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
