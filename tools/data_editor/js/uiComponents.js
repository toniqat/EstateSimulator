/**
 * UI Components Module
 * Reusable UI components like toasts, modals, etc.
 */

class UIComponents {
    /**
     * Show a toast notification
     * @param {string} message - Toast message
     * @param {string} type - 'success', 'error', 'warning' (default: 'success')
     * @param {Object|number} options - Duration in ms (for backwards compatibility) or options object
     *                                   options.duration - Duration in ms (default: 3000)
     *                                   options.label - Button label (optional)
     *                                   options.action - Callback function (optional)
     */
    static showToast(message, type = 'success', options = {}) {
        // Handle backwards compatibility: third param could be duration (number)
        let duration = 3000;
        let label = null;
        let action = null;

        if (typeof options === 'number') {
            duration = options;
        } else if (typeof options === 'object') {
            duration = options.duration ?? 3000;
            label = options.label;
            action = options.action;
        }

        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.style.display = 'flex';
        contentWrapper.style.alignItems = 'center';
        contentWrapper.style.justifyContent = 'space-between';
        contentWrapper.style.gap = '10px';
        contentWrapper.style.width = '100%';

        // Create message span
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;

        contentWrapper.appendChild(messageSpan);

        // Add action button if provided
        if (label && action) {
            const actionBtn = document.createElement('button');
            actionBtn.textContent = label;
            actionBtn.style.padding = '4px 12px';
            actionBtn.style.fontSize = '0.9em';
            actionBtn.style.border = 'none';
            actionBtn.style.borderRadius = '4px';
            actionBtn.style.cursor = 'pointer';
            actionBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            actionBtn.style.color = 'inherit';
            actionBtn.style.fontWeight = 'bold';
            actionBtn.style.whiteSpace = 'nowrap';

            actionBtn.addEventListener('click', () => {
                toast.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
                action();
            });

            contentWrapper.appendChild(actionBtn);
            // Don't auto-remove if there's an action (user must click)
            duration = null;
        }

        toast.appendChild(contentWrapper);
        container.appendChild(toast);

        // Auto-remove after duration (unless there's an action)
        if (duration) {
            setTimeout(() => {
                if (toast.parentElement) { // Check if still in DOM
                    toast.style.animation = 'slideIn 0.3s ease-out reverse';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }
    }

    /**
     * Show enum creation modal
     * @param {string} fieldName - Name of the field being edited
     * @returns {Promise<string>} Promise resolving to new enum value or null if cancelled
     */
    static showEnumModal(fieldName) {
        return new Promise(resolve => {
            const modal = document.getElementById('enumModal');
            const fieldNameSpan = document.getElementById('enumFieldName');
            const inputField = document.getElementById('enumInputField');
            const confirmBtn = document.getElementById('enumConfirmBtn');
            const cancelBtn = document.getElementById('enumCancelBtn');
            const closeBtn = modal.querySelector('.modal-close');

            fieldNameSpan.textContent = fieldName;
            inputField.value = '';
            inputField.focus();

            const cleanup = () => {
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                inputField.removeEventListener('keypress', onKeyPress);
            };

            const onConfirm = () => {
                const value = inputField.value.trim();
                cleanup();
                resolve(value || null);
            };

            const onCancel = () => {
                cleanup();
                resolve(null);
            };

            const onKeyPress = (e) => {
                if (e.key === 'Enter') {
                    onConfirm();
                }
            };

            modal.style.display = 'flex';
            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            inputField.addEventListener('keypress', onKeyPress);
        });
    }

    /**
     * Update status text in header
     * @param {string} text - Status message
     */
    static updateStatus(text) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = text;
        }
    }

    /**
     * Enable/disable loading state on button
     * @param {HTMLElement} button - Button element
     * @param {boolean} loading - True to show loading state
     */
    static setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = '⏳ Loading...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    /**
     * Create a simple alert dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @returns {Promise<void>}
     */
    static showAlert(title, message) {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${this._escapeHtml(title)}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>${this._escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary">OK</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const closeModal = () => {
                modal.remove();
                resolve();
            };

            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.querySelector('.btn-primary').addEventListener('click', closeModal);
        });
    }

    /**
     * Create a confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @returns {Promise<boolean>} Promise resolving to true if confirmed
     */
    static showConfirm(title, message) {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${this._escapeHtml(title)}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>${this._escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-primary confirm-btn">Confirm</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const closeModal = (result) => {
                modal.remove();
                resolve(result);
            };

            modal.querySelector('.modal-close').addEventListener('click', () => closeModal(false));
            modal.querySelector('.cancel-btn').addEventListener('click', () => closeModal(false));
            modal.querySelector('.confirm-btn').addEventListener('click', () => closeModal(true));
        });
    }

    /**
     * Show modal for adding a new header/column to CSV
     * @param {Array} existingHeaders - Array of existing header names to prevent duplicates
     * @returns {Promise<Object>} Promise resolving to {name, type} or null if cancelled
     */
    static showAddHeaderModal(existingHeaders = []) {
        return new Promise(resolve => {
            const modal = document.getElementById('addHeaderModal');
            const nameInput = document.getElementById('headerNameInput');
            const typeSelect = document.getElementById('headerTypeSelect');
            const confirmBtn = document.getElementById('headerConfirmBtn');
            const cancelBtn = document.getElementById('headerCancelBtn');
            const closeBtn = modal.querySelector('.modal-close');

            nameInput.value = '';
            typeSelect.value = 'string';
            nameInput.focus();

            const cleanup = () => {
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                nameInput.removeEventListener('keypress', onKeyPress);
            };

            const onConfirm = () => {
                const name = nameInput.value.trim();
                if (!name) {
                    UIComponents.showToast('Column name cannot be empty', 'warning');
                    return;
                }

                if (existingHeaders.map(h => h.toLowerCase()).includes(name.toLowerCase())) {
                    UIComponents.showToast('Column name already exists', 'warning');
                    return;
                }

                const type = typeSelect.value;
                cleanup();
                resolve({ name, type });
            };

            const onCancel = () => {
                cleanup();
                resolve(null);
            };

            const onKeyPress = (e) => {
                if (e.key === 'Enter') {
                    onConfirm();
                }
            };

            modal.style.display = 'flex';
            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            nameInput.addEventListener('keypress', onKeyPress);
        });
    }

    /**
     * Show modal for adding a column to a JSON array
     * @param {Array} existingColumns - Array of existing column names to prevent duplicates
     * @returns {Promise<string>} Promise resolving to column name or null if cancelled
     */
    static showAddColumnModal(existingColumns = []) {
        return new Promise(resolve => {
            const modal = document.getElementById('addColumnModal');
            const nameInput = document.getElementById('columnNameInput');
            const confirmBtn = document.getElementById('columnConfirmBtn');
            const cancelBtn = document.getElementById('columnCancelBtn');
            const closeBtn = modal.querySelector('.modal-close');

            nameInput.value = '';
            nameInput.focus();

            const cleanup = () => {
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                nameInput.removeEventListener('keypress', onKeyPress);
            };

            const onConfirm = () => {
                const name = nameInput.value.trim();
                if (!name) {
                    UIComponents.showToast('Column name cannot be empty', 'warning');
                    return;
                }

                if (existingColumns.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
                    UIComponents.showToast('Column name already exists', 'warning');
                    return;
                }

                cleanup();
                resolve(name);
            };

            const onCancel = () => {
                cleanup();
                resolve(null);
            };

            const onKeyPress = (e) => {
                if (e.key === 'Enter') {
                    onConfirm();
                }
            };

            modal.style.display = 'flex';
            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            nameInput.addEventListener('keypress', onKeyPress);
        });
    }

    /**
     * Escape HTML special characters
     * @private
     */
    static _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, char => map[char]);
    }
}
