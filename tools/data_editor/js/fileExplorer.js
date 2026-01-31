/**
 * File Explorer Module
 * Manages the left pane directory tree navigation
 */

class FileExplorer {
    constructor(container, headerContainer, persistence = null) {
        this.container = container;
        this.headerContainer = headerContainer;
        this.dirHandle = null;
        this.csvFileMap = new Map(); // Map of path -> CSV fileHandle
        this.selectedFile = null;
        this.onFileSelected = null;
        this.onDirectoryLoaded = null; // Callback when directory is loaded
        this.lastDirPath = this._loadLastDirPath();
        this.persistence = persistence; // Optional persistence module for directory handle storage
        this._setupHeaderButton();
    }

    /**
     * Setup the "Open Data Directory" button in the header
     * @private
     */
    _setupHeaderButton() {
        const btn = document.getElementById('openDirBtnExplorer');
        if (btn) {
            btn.title = 'Open Data Directory';
            btn.addEventListener('click', () => this.init());
        }
    }

    /**
     * Initialize file explorer with directory picker
     * Tries to reuse last directory handle if available, otherwise shows picker
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Check browser support
            if (!('showDirectoryPicker' in window)) {
                this.showBrowserWarning();
                return;
            }

            // Try to reuse last directory handle if available
            if (this.dirHandle) {
                // Already have a handle from earlier in this session
                await this.loadDirectory();
                return;
            }

            // Try to retrieve stored directory handle if persistence is available
            if (this.persistence) {
                const storedHandle = await this.persistence.getDirectoryHandle();
                if (storedHandle) {
                    this.dirHandle = storedHandle;
                    UIComponents.updateStatus(`Loading last folder: ${storedHandle.name}...`);
                    await this.loadDirectory();
                    return;
                }

                // If no valid handle but we have stored metadata, try restoring with permission
                // (user activation is available here from the button click)
                const restoredHandle = await this.persistence.restoreDirectoryHandleWithPermission();
                if (restoredHandle) {
                    this.dirHandle = restoredHandle;
                    UIComponents.updateStatus(`Restoring last folder: ${restoredHandle.name}...`);
                    await this.loadDirectory();
                    return;
                }
            }

            // Request directory access
            this.dirHandle = await window.showDirectoryPicker();

            // Save the directory handle for next time
            if (this.dirHandle) {
                if (this.persistence) {
                    await this.persistence.saveDirectoryHandle(this.dirHandle);
                }
                // Also save to localStorage as fallback
                if (this.dirHandle.name) {
                    this._saveLastDirPath(this.dirHandle.name);
                    this.lastDirPath = this.dirHandle.name;
                }
            }

            await this.loadDirectory();
        } catch (error) {
            if (error.name !== 'AbortError') {
                UIComponents.showToast(`Error accessing directory: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Load directory structure recursively
     * @private
     */
    async loadDirectory() {
        this.container.innerHTML = '';
        this.csvFileMap.clear();

        // Create tree structure
        const tree = document.createElement('div');
        tree.className = 'file-tree';

        try {
            await this._renderDirectory(this.dirHandle, tree, '');
            this.container.appendChild(tree);

            if (this.csvFileMap.size === 0) {
                // Still show the tree even if no CSV files found
                UIComponents.showToast('No CSV files found in directory', 'warning');
            }

            // Notify that directory is loaded
            if (this.onDirectoryLoaded) {
                this.onDirectoryLoaded();
            }
        } catch (error) {
            console.error('Error loading directory:', error.name, '-', error.message);

            // Handle permission errors specifically
            if (error.name === 'NotAllowedError') {
                this.dirHandle = null;
                if (this.persistence) {
                    try {
                        await this.persistence.clearAll();
                    } catch (e) {
                        // Ignore clear errors
                    }
                }
                UIComponents.showToast('Folder permissions lost. Please select the folder again.', 'error');
                this.container.innerHTML = `
                    <div class="placeholder">
                        <p>⚠️ Folder access was lost.</p>
                        <p>Permissions may have been revoked or the folder was moved.</p>
                        <p>Click "📁" button above to select your data directory again.</p>
                    </div>
                `;
            } else {
                console.error('Detailed error:', error);
                UIComponents.showToast(`Error loading directory: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Recursively render directory contents
     * Shows all files and folders, but only CSV files are selectable
     * @private
     */
    async _renderDirectory(dirHandle, container, parentPath) {
        const entries = [];

        try {
            for await (const entry of dirHandle.values()) {
                entries.push(entry);
            }
        } catch (error) {
            console.error('Error reading directory:', error);
            return;
        }

        // Sort: folders first, then files
        entries.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (const entry of entries) {
            const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

            if (entry.kind === 'directory') {
                // Create folder item
                const folderDiv = document.createElement('div');
                folderDiv.className = 'file-tree-item folder collapsed';

                const toggle = document.createElement('span');
                toggle.className = 'toggle';
                toggle.textContent = '▶';

                const label = document.createElement('span');
                label.className = 'folder-label';
                label.textContent = entry.name;

                folderDiv.appendChild(toggle);
                folderDiv.appendChild(label);
                container.appendChild(folderDiv);

                // Create children container
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'file-tree-children collapsed';

                // Lazy load on expand
                let loaded = false;
                const expandFolder = async () => {
                    if (!loaded) {
                        await this._renderDirectory(entry, childrenDiv, path);
                        loaded = true;
                    }

                    folderDiv.classList.toggle('collapsed');
                    childrenDiv.classList.toggle('collapsed');
                };

                folderDiv.addEventListener('click', (e) => {
                    if (e.target === folderDiv || e.target === toggle || e.target === label) {
                        expandFolder();
                    }
                });

                container.appendChild(childrenDiv);
            } else {
                // Create file item (both CSV and non-CSV)
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file-tree-item file';

                const isCsvFile = entry.name.endsWith('.csv');

                // Only CSV files are clickable
                if (isCsvFile) {
                    fileDiv.textContent = entry.name;
                    fileDiv.style.cursor = 'pointer';
                    fileDiv.addEventListener('click', () => this._selectFile(fileDiv, entry, path));
                    this.csvFileMap.set(path, entry);
                } else {
                    // Non-CSV files are visible but disabled
                    fileDiv.textContent = entry.name;
                    fileDiv.style.opacity = '0.5';
                    fileDiv.style.cursor = 'default';
                    fileDiv.title = 'Only CSV files can be selected';
                }

                container.appendChild(fileDiv);
            }
        }
    }

    /**
     * Handle file selection
     * @private
     */
    async _selectFile(element, fileHandle, path) {
        // Update UI
        document.querySelectorAll('.file-tree-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        element.classList.add('selected');

        this.selectedFile = { handle: fileHandle, path };

        // Read file content
        try {
            const file = await fileHandle.getFile();
            const content = await file.text();

            // Notify listener
            if (this.onFileSelected) {
                this.onFileSelected({
                    path,
                    name: fileHandle.name,
                    content,
                    fileHandle
                });
            }
        } catch (error) {
            UIComponents.showToast(`Error reading file: ${error.message}`, 'error');
        }
    }

    /**
     * Mark file as modified in UI
     * @param {string} path - File path
     * @param {boolean} modified - True if modified
     */
    markModified(path, modified) {
        const item = this.container.querySelector(
            `.file-tree-item[data-path="${path}"]`
        );
        if (item) {
            if (modified) {
                item.classList.add('modified');
            } else {
                item.classList.remove('modified');
            }
        }
    }

    /**
     * Save last used directory path to localStorage
     * @private
     */
    _saveLastDirPath(dirName) {
        try {
            localStorage.setItem('dataEditor_lastDirPath', dirName);
        } catch (error) {
            console.warn('Could not save directory path:', error);
        }
    }

    /**
     * Load last used directory path from localStorage
     * @private
     */
    _loadLastDirPath() {
        try {
            return localStorage.getItem('dataEditor_lastDirPath') || null;
        } catch (error) {
            console.warn('Could not load directory path:', error);
            return null;
        }
    }

    /**
     * Show browser compatibility warning
     * @private
     */
    showBrowserWarning() {
        this.container.innerHTML = `
            <div class="placeholder">
                <p>File System Access API not supported in this browser.</p>
                <p>Please use:</p>
                <ul style="text-align: left; padding: 0 16px; margin-top: 8px;">
                    <li>Chrome 86+</li>
                    <li>Edge 86+</li>
                </ul>
            </div>
        `;
    }
}
