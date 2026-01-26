/**
 * Tab Manager Module
 * Manages tabbed interface for multiple open files
 */

class TabManager {
    constructor(tabsListContainer) {
        this.tabsListContainer = tabsListContainer;
        this.openTabs = new Map(); // Map of file path -> { name, handle, isActive }
        this.activeTabPath = null;
        this.onTabChanged = null; // Callback when active tab changes
    }

    /**
     * Open a new tab or switch to existing tab
     * @param {string} filePath - Path to the file
     * @param {string} fileName - Name of the file
     * @param {FileSystemFileHandle} fileHandle - File handle
     * @returns {boolean} True if this is a new tab, false if switching to existing
     */
    openTab(filePath, fileName, fileHandle) {
        const isNewTab = !this.openTabs.has(filePath);

        // Store tab data
        this.openTabs.set(filePath, {
            name: fileName,
            handle: fileHandle,
            isActive: true
        });

        // Deactivate all tabs
        for (const [path, tab] of this.openTabs) {
            tab.isActive = path === filePath;
        }

        this.activeTabPath = filePath;
        this._renderTabs();

        // Notify about tab change
        if (this.onTabChanged) {
            this.onTabChanged(filePath, isNewTab);
        }

        return isNewTab;
    }

    /**
     * Close a tab
     * @param {string} filePath - Path to the file
     * @returns {string|null} Path to the next active tab, or null if no tabs left
     */
    closeTab(filePath) {
        if (!this.openTabs.has(filePath)) {
            return this.activeTabPath;
        }

        this.openTabs.delete(filePath);

        // If we closed the active tab, switch to another one
        if (this.activeTabPath === filePath) {
            const remainingTabs = Array.from(this.openTabs.keys());

            if (remainingTabs.length > 0) {
                // Switch to the last remaining tab
                this.activeTabPath = remainingTabs[remainingTabs.length - 1];
                this.openTabs.get(this.activeTabPath).isActive = true;
            } else {
                this.activeTabPath = null;
            }
        }

        this._renderTabs();

        // Notify about tab change (even if activeTabPath is null)
        if (this.onTabChanged) {
            this.onTabChanged(this.activeTabPath, false);
        }

        return this.activeTabPath;
    }

    /**
     * Activate a specific tab
     * @param {string} filePath - Path to the file
     */
    switchToTab(filePath) {
        if (!this.openTabs.has(filePath)) {
            return;
        }

        // Deactivate all tabs
        for (const [path, tab] of this.openTabs) {
            tab.isActive = path === filePath;
        }

        this.activeTabPath = filePath;
        this._renderTabs();

        // Notify about tab change
        if (this.onTabChanged) {
            this.onTabChanged(filePath, false);
        }
    }

    /**
     * Get the currently active tab path
     * @returns {string|null}
     */
    getActiveTabPath() {
        return this.activeTabPath;
    }

    /**
     * Check if a file is already open in a tab
     * @param {string} filePath - Path to check
     * @returns {boolean}
     */
    isTabOpen(filePath) {
        return this.openTabs.has(filePath);
    }

    /**
     * Get count of open tabs
     * @returns {number}
     */
    getTabCount() {
        return this.openTabs.size;
    }

    /**
     * Render all tabs
     * @private
     */
    _renderTabs() {
        this.tabsListContainer.innerHTML = '';

        for (const [filePath, tab] of this.openTabs) {
            const tabElement = document.createElement('div');
            tabElement.className = `tab ${tab.isActive ? 'active' : ''}`;
            tabElement.dataset.filePath = filePath;

            // Tab name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'tab-name';
            nameSpan.textContent = tab.name;
            tabElement.appendChild(nameSpan);

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close-btn';
            closeBtn.textContent = '✕';
            closeBtn.setAttribute('aria-label', `Close ${tab.name}`);
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._handleTabClose(filePath);
            });
            tabElement.appendChild(closeBtn);

            // Tab click to switch
            tabElement.addEventListener('click', () => {
                this.switchToTab(filePath);
            });

            this.tabsListContainer.appendChild(tabElement);
        }

        // Show/hide tab bar based on number of tabs
        const tabBar = this.tabsListContainer.parentElement;
        if (this.openTabs.size > 0) {
            tabBar.classList.add('visible');
        } else {
            tabBar.classList.remove('visible');
        }
    }

    /**
     * Handle tab close button click
     * @private
     */
    _handleTabClose(filePath) {
        const nextTab = this.closeTab(filePath);

        // If there's another tab, switch to it
        if (nextTab) {
            this.switchToTab(nextTab);
        }
    }
}
