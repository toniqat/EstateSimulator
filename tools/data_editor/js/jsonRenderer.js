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
     * @returns {HTMLElement} Rendered element
     */
    static render(data, onChange, guessedType = 'object') {
        if (data === '' || data === null || data === undefined) {
            return this._renderEmptyState(onChange, guessedType);
        }

        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;

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
     * @private
     */
    static _renderEmptyState(onChange, guessedType = 'object') {
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
            addKeyBtn.addEventListener('click', async () => {
                const keyName = await this._promptForKeyName(Object.keys(emptyObject));
                if (keyName) {
                    emptyObject[keyName] = '';
                    if (onChange) onChange(emptyObject);
                    // Re-render
                    container.innerHTML = '';
                    container.appendChild(this._renderObject(emptyObject, onChange));
                }
            });
            container.appendChild(addKeyBtn);
        }

        return container;
    }

    /**
     * Prompt user for a key name (simple modal-like dialog)
     * @private
     */
    static async _promptForKeyName(existingKeys = []) {
        return new Promise(resolve => {
            const keyName = prompt('Enter key name:');
            if (keyName && !existingKeys.includes(keyName)) {
                resolve(keyName);
            } else if (keyName && existingKeys.includes(keyName)) {
                alert('Key already exists');
                resolve(null);
            } else {
                resolve(null);
            }
        });
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

        // Determine columns from first item
        const firstItem = arr[0];
        let columns = [];

        if (typeof firstItem === 'object' && firstItem !== null) {
            columns = Object.keys(firstItem);
        } else {
            columns = ['value'];
        }

        // Create table
        const table = document.createElement('table');
        table.className = 'json-table';

        // Body rows
        const tbody = document.createElement('tbody');

        arr.forEach((item, index) => {
            const row = document.createElement('tr');

            columns.forEach(col => {
                const td = document.createElement('td');
                const value = item[col] ?? '';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = typeof value === 'object' ? JSON.stringify(value) : value;

                input.addEventListener('change', () => {
                    arr[index][col] = this._parseInputValue(input.value);
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
            const newItem = {};
            columns.forEach(col => {
                newItem[col] = '';
            });
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
     * Render object as form
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
            addKeyBtn.addEventListener('click', async () => {
                const keyName = await this._promptForKeyName([]);
                if (keyName) {
                    obj[keyName] = '';
                    if (onChange) onChange(obj);
                    // Re-render
                    container.innerHTML = '';
                    container.appendChild(this._renderObject(obj, onChange));
                }
            });
            container.appendChild(addKeyBtn);
            return container;
        }

        keys.forEach(key => {
            const value = obj[key];
            const group = document.createElement('div');
            group.className = 'json-form-group';

            const label = document.createElement('label');
            label.className = 'json-form-label';
            label.textContent = key;

            group.appendChild(label);

            if (Array.isArray(value)) {
                // Nested array
                const nestedDiv = document.createElement('div');
                nestedDiv.className = 'json-nested';

                const header = document.createElement('div');
                header.className = 'json-nested-header';
                header.innerHTML = `<span class="json-nested-toggle">▼</span> Array (${value.length} item${value.length !== 1 ? 's' : ''})`;

                const content = document.createElement('div');
                content.className = 'json-nested-content';
                content.appendChild(this._renderArray(value, (newValue) => {
                    obj[key] = newValue;
                    if (onChange) onChange(obj);
                }));

                header.addEventListener('click', () => {
                    nestedDiv.classList.toggle('collapsed');
                });

                nestedDiv.appendChild(header);
                nestedDiv.appendChild(content);
                group.appendChild(nestedDiv);
            } else if (typeof value === 'object' && value !== null) {
                // Nested object
                const nestedDiv = document.createElement('div');
                nestedDiv.className = 'json-nested';

                const header = document.createElement('div');
                header.className = 'json-nested-header';
                header.innerHTML = `<span class="json-nested-toggle">▼</span> Object`;

                const content = document.createElement('div');
                content.className = 'json-nested-content';
                content.appendChild(this._renderObject(value, (newValue) => {
                    obj[key] = newValue;
                    if (onChange) onChange(obj);
                }));

                header.addEventListener('click', () => {
                    nestedDiv.classList.toggle('collapsed');
                });

                nestedDiv.appendChild(header);
                nestedDiv.appendChild(content);
                group.appendChild(nestedDiv);
            } else {
                // Primitive value
                const input = document.createElement('input');
                input.className = 'inspector-field-input';
                input.type = 'text';
                input.value = value ?? '';

                input.addEventListener('change', () => {
                    obj[key] = this._parseInputValue(input.value);
                    if (onChange) onChange(obj);
                });

                group.appendChild(input);
            }

            container.appendChild(group);
        });

        // Add "Add Key" button at the end
        const addKeyBtnGroup = document.createElement('div');
        addKeyBtnGroup.className = 'json-add-key-group';
        addKeyBtnGroup.style.marginTop = '12px';

        const addKeyBtn = document.createElement('button');
        addKeyBtn.className = 'json-add-row-btn';
        addKeyBtn.innerHTML = '+ Add Key';
        addKeyBtn.addEventListener('click', async () => {
            const keyName = await this._promptForKeyName(keys);
            if (keyName) {
                obj[keyName] = '';
                if (onChange) onChange(obj);
                // Re-render
                container.innerHTML = '';
                container.appendChild(this._renderObject(obj, onChange));
            }
        });
        addKeyBtnGroup.appendChild(addKeyBtn);
        container.appendChild(addKeyBtnGroup);

        return container;
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
