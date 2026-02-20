/**
 * Data Inspector Module
 * Manages the right pane field editor and inspection
 *
 * FEATURES:
 * - Multi-row editing: Select multiple rows and edit them simultaneously
 *   All changes apply to all selected rows
 * - Complex data locking: JSON/Array fields with mixed values show an "Unlock" toggle
 *   - Default (Locked): Shows "<Mixed Values - Unlock to edit>" message
 *   - When Unlocked: Shows editor for the top-most selected row's data
 *   - Applies changes to all selected rows
 * - Form View: Shows unlock toggles below field labels for JSON fields with mixed values
 * - Table View: Shows unlock toggles at the top for all JSON fields with mixed values
 */

class DataInspector {
    constructor(container) {
        this.container = container;
        this.headers = [];
        this.rows = [];
        this.idColumn = null;
        this.selectedIndices = [];
        this.typeInfo = {};
        this.currentValues = {};
        this.onDataChanged = null;
        this.onAddColumn = null;
        this.viewMode = 'form'; // 'form' or 'table'
        this.lockedFields = new Set(); // Track which JSON fields are locked
        this.vectorGroups = new Map(); // Map of vector group name -> { components: [...] }
        this.vectorGroupHeaders = new Set(); // Set of headers that are part of a vector group
    }

    /**
     * Load data for inspection
     * @param {Array} headers - Column names
     * @param {Array} rows - Row objects
     * @param {string} idColumn - ID column name
     * @param {Array} selectedIndices - Selected row indices (or legacy selectedIds for backward compatibility)
     * @param {Object} typeInfo - Type information for columns
     */
    load(headers, rows, idColumn, selectedIndices, typeInfo) {
        this.headers = headers;
        this.rows = rows;
        this.idColumn = idColumn;
        // Support both selectedIndices (new) and legacy selectedIds for backward compatibility
        this.selectedIndices = selectedIndices || [];
        this.typeInfo = typeInfo;

        // Reset locked fields when loading new data to avoid stale state
        this.lockedFields.clear();

        // Detect vector groups
        this.vectorGroups = TypeInference.detectVectorGroups(headers);
        this.vectorGroupHeaders.clear();
        this.vectorGroups.forEach((group) => {
            group.components.forEach(comp => {
                this.vectorGroupHeaders.add(comp.header);
            });
        });

        // Update delete button visibility
        this._updateDeleteButtonVisibility();

        this.render();
    }

    /**
     * Render the inspector
     */
    render() {
        this.container.innerHTML = '';

        if (this.selectedIndices.length === 0) {
            this.container.innerHTML = '<p class="placeholder">Select a row to inspect</p>';
            return;
        }

        // Get selected rows by index (maintains order, always gets correct row even with duplicate IDs)
        const selectedRows = CSVParser.getRowsByIndices(this.rows, this.selectedIndices);

        if (selectedRows.length === 0) {
            this.container.innerHTML = '<p class="placeholder">No rows found</p>';
            return;
        }

        // Render based on view mode
        if (this.viewMode === 'table') {
            this._renderTableView(selectedRows);
        } else {
            this._renderFormView(selectedRows);
        }
    }

    /**
     * Render form view (single-line horizontal layout)
     * @private
     */
    _renderFormView(selectedRows) {
        // Update container class
        this.container.className = 'inspector inspector-form-view';

        const renderedHeaders = new Set(); // Track which headers have been rendered

        // Render fields
        this.headers.forEach(header => {
            // Skip if already rendered (part of a vector group)
            if (renderedHeaders.has(header)) {
                return;
            }

            // Check if this header is part of a vector group
            let isVectorComponent = false;
            let vectorGroupName = null;
            for (const [groupName, group] of this.vectorGroups.entries()) {
                if (group.components.some(comp => comp.header === header)) {
                    isVectorComponent = true;
                    vectorGroupName = groupName;
                    break;
                }
            }

            // If this is a vector component, render the entire vector group
            if (isVectorComponent && vectorGroupName) {
                const group = this.vectorGroups.get(vectorGroupName);
                this._renderVectorField(selectedRows, vectorGroupName, group);
                group.components.forEach(comp => {
                    renderedHeaders.add(comp.header);
                });
                return;
            }

            // Render regular field
            const fieldDiv = document.createElement('div');
            const isIdColumn = header === this.idColumn;
            let typeInf = this.typeInfo[header] || { type: 'string' };

            // ID columns are always rendered as string/input, never as enum
            if (isIdColumn && typeInf.type === 'enum') {
                typeInf = { type: 'string' };
            }

            // Get values from selected rows
            const values = selectedRows.map(row => row[header] ?? '');
            const allSame = values.every(v => v === values[0]);

            // Mark complex data fields (JSON) with special class for multi-line layout
            if (typeInf.type === 'json') {
                fieldDiv.className = 'inspector-field complex-data';
            } else {
                fieldDiv.className = 'inspector-field';
            }

            const label = document.createElement('label');
            label.className = 'inspector-field-label';
            label.textContent = header;

            fieldDiv.appendChild(label);

            // For JSON fields with mixed values, add unlock toggle
            if (typeInf.type === 'json' && !allSame) {
                this._renderLockToggle(fieldDiv, header);
            }

            // Render input based on type
            if (typeInf.type === 'json') {
                this._renderJSONField(fieldDiv, header, values, allSame, selectedRows);
            } else if (typeInf.type === 'enum') {
                this._renderEnumField(fieldDiv, header, values, allSame, typeInf.options);
            } else if (typeInf.type === 'number') {
                this._renderNumberField(fieldDiv, header, values, allSame);
            } else {
                this._renderStringField(fieldDiv, header, values, allSame);
            }

            this.container.appendChild(fieldDiv);
            renderedHeaders.add(header);
        });

        // Add "Add Column" button at the bottom
        if (this.onAddColumn) {
            const buttonDiv = document.createElement('div');
            buttonDiv.className = 'inspector-add-column-container';

            const addColumnBtn = document.createElement('button');
            addColumnBtn.className = 'btn btn-secondary inspector-add-column-btn';
            addColumnBtn.textContent = '➕ Add Column';
            addColumnBtn.addEventListener('click', () => this.onAddColumn());

            buttonDiv.appendChild(addColumnBtn);
            this.container.appendChild(buttonDiv);
        }
    }

    /**
     * Render table view
     * @private
     */
    _renderTableView(selectedRows) {
        // Update container class
        this.container.className = 'inspector inspector-table-view';

        const wrapper = document.createElement('div');
        wrapper.className = 'inspector-table-wrapper';

        // Add lock toggles for JSON columns with mixed values if needed
        const jsonHeadersWithMixed = this._getJsonHeadersWithMixedValues(selectedRows);
        if (jsonHeadersWithMixed.length > 0) {
            const togglesDiv = document.createElement('div');
            togglesDiv.className = 'inspector-table-toggles';

            const title = document.createElement('div');
            title.className = 'inspector-table-toggles-title';
            title.textContent = 'JSON Field Locks (for rows with mixed values):';
            togglesDiv.appendChild(title);

            jsonHeadersWithMixed.forEach(header => {
                const toggleDiv = document.createElement('div');
                toggleDiv.className = 'inspector-table-toggle-item';

                const label = document.createElement('label');
                label.className = 'inspector-field-lock-label';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'inspector-field-lock-checkbox';
                // Checked = Unlocked, so invert the logic
                checkbox.checked = !this.lockedFields.has(header);
                checkbox.id = `table-lock-${header}`;

                const labelText = document.createElement('span');
                labelText.textContent = `${header}: Unlock to edit`;

                label.appendChild(checkbox);
                label.appendChild(labelText);
                toggleDiv.appendChild(label);

                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        // Checkbox checked = Unlocked
                        this.lockedFields.delete(header);
                    } else {
                        // Checkbox unchecked = Locked
                        this.lockedFields.add(header);
                    }
                    // Re-render to apply lock changes
                    this.render();
                });

                togglesDiv.appendChild(toggleDiv);
            });

            wrapper.appendChild(togglesDiv);
        }

        const table = document.createElement('table');
        table.className = 'inspector-table';

        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        this.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body rows
        const tbody = document.createElement('tbody');

        selectedRows.forEach((row) => {
            const tr = document.createElement('tr');

            this.headers.forEach(header => {
                const td = document.createElement('td');
                const value = row[header] ?? '';
                const isIdColumn = header === this.idColumn;
                let typeInf = this.typeInfo[header] || { type: 'string' };

                // ID columns are always rendered as string/input, never as enum
                if (isIdColumn && typeInf.type === 'enum') {
                    typeInf = { type: 'string' };
                }

                // Check if this is a JSON field with mixed values and is locked
                const isJsonWithMixed = typeInf.type === 'json' &&
                    !selectedRows.every(r => (r[header] ?? '') === value);
                const isLocked = this.lockedFields.has(header);

                // Render input based on type
                if (typeInf.type === 'enum') {
                    const select = document.createElement('select');
                    typeInf.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        select.appendChild(option);
                    });

                    select.value = value;
                    select.addEventListener('change', () => {
                        this._updateField(header, select.value);
                    });

                    td.appendChild(select);
                } else if (typeInf.type === 'number') {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.value = value;
                    input.addEventListener('change', () => {
                        this._updateField(header, input.value);
                    });
                    td.appendChild(input);
                } else if (typeInf.type === 'json') {
                    if (isJsonWithMixed && isLocked) {
                        // Locked JSON field with mixed values
                        const span = document.createElement('span');
                        span.className = 'inspector-table-locked-cell';
                        span.textContent = '<Locked>';
                        td.appendChild(span);
                    } else {
                        // Editable JSON field
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = typeof value === 'string' ? value : JSON.stringify(value);
                        input.addEventListener('change', () => {
                            this._updateField(header, input.value);
                        });
                        td.appendChild(input);
                    }
                } else {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = value;
                    input.addEventListener('change', () => {
                        this._updateField(header, input.value);
                    });
                    td.appendChild(input);
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        wrapper.appendChild(table);
        this.container.appendChild(wrapper);
    }

    /**
     * Get JSON headers that have mixed values in selected rows
     * @private
     */
    _getJsonHeadersWithMixedValues(selectedRows) {
        const result = [];
        this.headers.forEach(header => {
            if (header === this.idColumn) return;
            const typeInf = this.typeInfo[header] || { type: 'string' };
            if (typeInf.type === 'json') {
                const values = selectedRows.map(row => row[header] ?? '');
                const allSame = values.every(v => v === values[0]);
                if (!allSame) {
                    result.push(header);
                }
            }
        });
        return result;
    }

    /**
     * Render string input field
     * @private
     */
    _renderStringField(fieldDiv, header, values, allSame) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inspector-field-input';

        if (allSame) {
            input.value = values[0] || '';
            input.placeholder = 'Enter text...';
        } else {
            input.className += ' mixed';
            input.placeholder = '<Mixed Values>';
            input.disabled = true;
        }

        input.addEventListener('change', () => {
            this._updateField(header, input.value);
        });

        fieldDiv.appendChild(input);
    }

    /**
     * Render number input field
     * @private
     */
    _renderNumberField(fieldDiv, header, values, allSame) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'inspector-field-input';

        if (allSame) {
            input.value = values[0] || '';
            input.placeholder = 'Enter number...';
        } else {
            input.className += ' mixed';
            input.placeholder = '<Mixed Values>';
            input.disabled = true;
        }

        input.addEventListener('change', () => {
            this._updateField(header, input.value);
        });

        fieldDiv.appendChild(input);
    }

    /**
     * Render enum select field
     * @private
     */
    _renderEnumField(fieldDiv, header, values, allSame, options) {
        const select = document.createElement('select');
        select.className = 'inspector-field-input';

        // Add options
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            select.appendChild(option);
        });

        // Add "Create New" option
        const createNewOption = document.createElement('option');
        createNewOption.value = '__create_new__';
        createNewOption.textContent = '+ Create New';
        select.appendChild(createNewOption);

        // Set value
        if (allSame) {
            select.value = values[0];
        } else {
            select.className += ' mixed';
            select.disabled = true;
        }

        select.addEventListener('change', async () => {
            if (select.value === '__create_new__') {
                const newValue = await UIComponents.showEnumModal(header);
                if (newValue) {
                    // Add to options
                    options.push(newValue);
                    options.sort();

                    // Recreate select with new option
                    select.innerHTML = '';
                    options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        select.appendChild(option);
                    });
                    const createNewOpt = document.createElement('option');
                    createNewOpt.value = '__create_new__';
                    createNewOpt.textContent = '+ Create New';
                    select.appendChild(createNewOpt);

                    // Set value and update
                    select.value = newValue;
                    this._updateField(header, newValue);
                } else {
                    // Reset to previous value
                    select.value = allSame ? values[0] : '';
                }
            } else {
                this._updateField(header, select.value);
            }
        });

        fieldDiv.appendChild(select);
    }

    /**
     * Render lock toggle for complex fields
     * Checkbox checked = Unlocked, Checkbox unchecked = Locked (default)
     * @private
     */
    _renderLockToggle(fieldDiv, header) {
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'inspector-field-lock-toggle';

        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'inspector-field-lock-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'inspector-field-lock-checkbox';
        // Checked = Unlocked, so invert the logic
        checkbox.checked = !this.lockedFields.has(header);
        checkbox.id = `lock-${header}`;

        const labelText = document.createElement('span');
        labelText.textContent = 'Unlock (Edit from top row)';

        toggleLabel.appendChild(checkbox);
        toggleLabel.appendChild(labelText);
        toggleDiv.appendChild(toggleLabel);

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Checkbox checked = Unlocked
                this.lockedFields.delete(header);
            } else {
                // Checkbox unchecked = Locked
                this.lockedFields.add(header);
            }
            // Re-render to show/hide the editor
            this.render();
        });

        fieldDiv.appendChild(toggleDiv);
    }

    /**
     * Render a vector group field (e.g., GridX/GridY as "Grid [X] x [Y]")
     * @private
     */
    _renderVectorField(selectedRows, groupName, group) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'inspector-field vector-field';

        const label = document.createElement('label');
        label.className = 'inspector-field-label';
        label.textContent = groupName;

        fieldDiv.appendChild(label);

        const vectorContainer = document.createElement('div');
        vectorContainer.className = 'vector-inputs-container';

        // Create input for each component (X, Y, Z)
        group.components.forEach((comp, index) => {
            const values = selectedRows.map(row => row[comp.header] ?? '');
            const allSame = values.every(v => v === values[0]);

            const inputGroup = document.createElement('div');
            inputGroup.className = 'vector-input-group';

            const inputLabel = document.createElement('label');
            inputLabel.className = 'vector-input-label';
            inputLabel.textContent = comp.suffix;
            inputGroup.appendChild(inputLabel);

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'inspector-field-input vector-input';

            if (allSame) {
                input.value = values[0] || '';
                input.placeholder = 'Enter number...';
            } else {
                input.className += ' mixed';
                input.placeholder = '<Mixed Values>';
                input.disabled = true;
            }

            input.addEventListener('change', () => {
                this._updateField(comp.header, input.value);
            });

            inputGroup.appendChild(input);

            // Add separator between components (except after last)
            if (index < group.components.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'vector-separator';
                separator.textContent = '×';
                inputGroup.appendChild(separator);
            }

            vectorContainer.appendChild(inputGroup);
        });

        fieldDiv.appendChild(vectorContainer);
        this.container.appendChild(fieldDiv);
    }

    /**
     * Render JSON field
     * @private
     */
    _renderJSONField(fieldDiv, header, values, allSame, selectedRows) {
        const container = document.createElement('div');
        const isLocked = this.lockedFields.has(header);

        // Create CSV context for schema inference
        const context = {
            rows: this.rows,
            columnName: header,
            headers: this.headers
        };

        if (allSame && values[0]) {
            // Non-empty, all same
            try {
                const parsed = typeof values[0] === 'string'
                    ? JSON.parse(values[0])
                    : values[0];

                const guessedType = Array.isArray(parsed) ? 'array' : 'object';
                const jsonRendererElement = JSONRenderer.render(parsed, (newValue) => {
                    this._updateField(header, JSONRenderer.serialize(newValue));
                }, guessedType, this.typeInfo[header], context);

                container.appendChild(jsonRendererElement);
            } catch (error) {
                container.innerHTML = `<div class="json-error"><strong>Invalid JSON:</strong> ${error.message}</div>`;
            }
        } else if (!allSame) {
            // Mixed values case
            if (isLocked) {
                // Locked: show message
                const mixedDiv = document.createElement('div');
                mixedDiv.className = 'inspector-field-input mixed';
                mixedDiv.style.padding = '6px 8px';
                mixedDiv.textContent = '<Mixed Values - Unlock to edit>';
                container.appendChild(mixedDiv);
            } else {
                // Unlocked: show editor with top-most row's data
                if (selectedRows && selectedRows.length > 0) {
                    const topRowValue = selectedRows[0][header] ?? '';
                    try {
                        let parsed;
                        if (topRowValue) {
                            parsed = typeof topRowValue === 'string'
                                ? JSON.parse(topRowValue)
                                : topRowValue;
                        } else {
                            // Empty value - infer type from other rows
                            parsed = '';
                        }

                        const guessedType = Array.isArray(parsed) ? 'array' : 'object';
                        const jsonRendererElement = JSONRenderer.render(parsed, (newValue) => {
                            this._updateField(header, JSONRenderer.serialize(newValue));
                        }, guessedType, this.typeInfo[header], context);

                        // Add a note about multi-row editing
                        const noteDiv = document.createElement('div');
                        noteDiv.className = 'inspector-field-note';
                        noteDiv.textContent = `Editing top row (${this.selectedIndices.length} rows selected)`;
                        container.appendChild(noteDiv);
                        container.appendChild(jsonRendererElement);
                    } catch (error) {
                        container.innerHTML = `<div class="json-error"><strong>Invalid JSON:</strong> ${error.message}</div>`;
                    }
                } else {
                    // Editable empty state
                    const jsonRendererElement = JSONRenderer.render('', (newValue) => {
                        this._updateField(header, JSONRenderer.serialize(newValue));
                    }, 'object', this.typeInfo[header], context);
                    container.appendChild(jsonRendererElement);
                }
            }
        } else {
            // Empty field (all same and empty)
            const jsonRendererElement = JSONRenderer.render('', (newValue) => {
                this._updateField(header, JSONRenderer.serialize(newValue));
            }, 'object', this.typeInfo[header], context);
            container.appendChild(jsonRendererElement);
        }

        fieldDiv.appendChild(container);
    }

    /**
     * Update a field for selected rows
     * @private
     */
    _updateField(header, value) {
        // Check if this is a JSON field and handle schema propagation
        const typeInf = this.typeInfo[header];
        if (typeInf && typeInf.type === 'json') {
            this._propagateJSONSchema(header, value);
        }

        // Update the selected rows by index (supports duplicate IDs)
        this.selectedIndices.forEach(index => {
            if (index >= 0 && index < this.rows.length) {
                this.rows[index][header] = value;
            }
        });

        if (this.onDataChanged) {
            this.onDataChanged();
        }
    }

    /**
     * Propagate JSON schema changes to selected rows only
     * If a new key is added to a JSON object in one row, it's applied to other SELECTED rows
     * This prevents accidental schema propagation to unselected rows
     * @private
     */
    _propagateJSONSchema(columnName, newValue) {
        // Parse the new JSON value
        let newObj = {};
        try {
            if (newValue && typeof newValue === 'string') {
                newObj = JSON.parse(newValue);
            } else if (typeof newValue === 'object') {
                newObj = newValue;
            }
        } catch (error) {
            // Invalid JSON, skip schema propagation
            return;
        }

        // Only handle objects (not arrays or primitives)
        if (!newObj || typeof newObj !== 'object' || Array.isArray(newObj)) {
            return;
        }

        const newKeys = Object.keys(newObj);

        // Go through ONLY SELECTED rows and check if they're missing any keys
        // This prevents unintended schema propagation to the entire column
        this.selectedIndices.forEach(selectedIndex => {
            const row = this.rows[selectedIndex];
            if (!row) return;

            const currentValue = row[columnName];
            let currentObj = {};

            try {
                if (currentValue && typeof currentValue === 'string') {
                    currentObj = JSON.parse(currentValue);
                } else if (typeof currentValue === 'object') {
                    currentObj = currentValue;
                }
            } catch (error) {
                // Skip invalid JSON
                return;
            }

            // Only process objects
            if (!currentObj || typeof currentObj !== 'object' || Array.isArray(currentObj)) {
                return;
            }

            const currentKeys = Object.keys(currentObj);
            let hasNewKeys = false;

            // Add any missing keys from the new schema
            newKeys.forEach(key => {
                if (!currentKeys.includes(key)) {
                    currentObj[key] = '';
                    hasNewKeys = true;
                }
            });

            // Update the row if new keys were added
            if (hasNewKeys) {
                row[columnName] = JSON.stringify(currentObj);
            }
        });
    }

    /**
     * Toggle between form and table view
     */
    toggleViewMode() {
        this.viewMode = this.viewMode === 'form' ? 'table' : 'form';
        this.render();
    }

    /**
     * Get current view mode
     */
    getViewMode() {
        return this.viewMode;
    }

    /**
     * Clear the inspector
     */
    clear() {
        this.container.innerHTML = '<p class="placeholder">Select a row to inspect</p>';
        this.selectedIndices = [];
        this.lockedFields.clear();
        this._updateDeleteButtonVisibility();
    }

    /**
     * Update delete button visibility based on selection
     * @private
     */
    _updateDeleteButtonVisibility() {
        const deleteBtn = document.getElementById('deleteRowBtn');
        if (deleteBtn) {
            deleteBtn.style.display = this.selectedIndices.length > 0 ? '' : 'none';
        }
    }
}
