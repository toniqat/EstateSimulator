/**
 * UI Updater
 * Updates UI with current game state
 */
class UIUpdater {
    constructor(gameState, stashManager, uiBuilder, facilityStorageManager, navigationManager = null) {
        this.gameState = gameState;
        this.stashManager = stashManager;
        this.uiBuilder = uiBuilder;
        this.facilityStorageManager = facilityStorageManager;
        this.navigationManager = navigationManager;

        // State tracking for navigation indicators to avoid unnecessary DOM updates
        // Maps facilityId -> { upgradeAvailable, statusBadge }
        this.lastNavigationIndicatorState = {};

        // Stash change detection to prevent DOM flickering from constant rebuilds
        this.lastStashHash = '';

        // Trading Post capacity tracking to detect upgrades
        this.lastMaxQueueSlots = 0;
    }

    /**
     * Update entire UI with current game state
     */
    updateUI() {
        this.updateHeaderStats();
        this.updateFacilities();
        this.updateNavigationIndicators();
        this.updateAddFacilityButtonState(); // Update facility construction button state
        this.updateProductManagement(); // NEW
        this.updateZoneProgress(); // NEW
        this.updateStash();
        this.updateProcessingPlant();
        this.updateTrading();
        this.updateTradingPost();
        this.updateLodgeDisplay();
    }

    /**
     * Update header stats (gold, workers)
     */
    updateHeaderStats() {
        const goldDisplay = document.getElementById('goldDisplay');
        if (goldDisplay) goldDisplay.textContent = this.gameState.gold;

        const workerDisplay = document.getElementById('workerCountDisplay');
        if (workerDisplay) {
            workerDisplay.textContent = `${this.gameState.availableWorkers}/${this.gameState.totalWorkers}`;
        }
    }

    /**
     * Update facility cards
     */
    updateFacilities() {
        for (const facilityId in this.gameState.facilities) {
            const facility = this.gameState.facilities[facilityId];

            // Update old HTML elements (for non-grid facilities like lodge)
            const levelEl = document.getElementById(`${facilityId}-level`);
            if (levelEl) levelEl.textContent = facility.level;

            // Update facility level display in header
            const levelDisplayEl = document.getElementById(`${facilityId}-level-display`);
            if (levelDisplayEl) levelDisplayEl.textContent = `Lv ${facility.level}`;

            const workerEl = document.getElementById(`${facilityId}-workers`);
            if (workerEl) workerEl.textContent = facility.assignedWorkers;

            // Update product grid UI worker count
            const workerCountEl = document.getElementById(`${facilityId}-worker-count`);
            if (workerCountEl) {
                workerCountEl.textContent = facility.assignedWorkers || 0;
            }

            // Update upgrade button state
            this.updateUpgradeButtonState(facilityId);
        }
    }

    /**
     * Update upgrade button state (green if can upgrade, gray if cannot)
     * Button remains clickable in both states
     */
    updateUpgradeButtonState(facilityId) {
        const upgradeBtn = document.getElementById(`${facilityId}-upgrade-btn`);
        if (!upgradeBtn) return;

        // We need access to upgradeSystem - get it through global game object
        if (typeof game === 'undefined' || !game.upgradeSystem) return;

        const canUpgradeResult = game.upgradeSystem.canUpgrade(facilityId);
        const canUpgrade = canUpgradeResult.canUpgrade;

        if (canUpgrade) {
            upgradeBtn.classList.remove('insufficient-resources');
            upgradeBtn.style.backgroundColor = '#2ecc71'; // Green
        } else {
            upgradeBtn.classList.add('insufficient-resources');
            upgradeBtn.style.backgroundColor = '#95a5a6'; // Gray
        }
    }

    /**
     * Compute a hash of the current stash state to detect changes
     * This prevents unnecessary DOM rebuilds which cause hover state flickering
     */
    computeStashHash() {
        const slots = this.gameState.stash.slots;
        const capacity = this.gameState.stash.capacity;
        const filter = this.uiBuilder.currentStashFilter;

        // Create a string representation of stash contents and filter
        let hashParts = [capacity.toString(), filter];
        for (let i = 0; i < slots.length; i++) {
            if (slots[i]) {
                hashParts.push(`${i}:${slots[i].itemId}:${slots[i].quantity}`);
            }
        }

        return hashParts.join('|');
    }

    /**
     * Reset the stash hash to force a rebuild on next update
     * Called when filter changes to ensure the grid reflects the new filter
     */
    resetStashHash() {
        this.lastStashHash = '';
    }

    /**
     * Update stash display
     */
    updateStash() {
        const stashLevelEl = document.getElementById('stash-level');
        if (stashLevelEl) stashLevelEl.textContent = this.gameState.stash.level;

        const stashCapacityEl = document.getElementById('stash-capacity');
        if (stashCapacityEl) stashCapacityEl.textContent = this.gameState.stash.capacity;

        const stashUsedEl = document.getElementById('stash-used');
        if (stashUsedEl) {
            const usedSlots = this.gameState.stash.slots.filter(s => s !== null).length;
            stashUsedEl.textContent = usedSlots;
        }

        // Update upgrade button state
        this.updateUpgradeButtonState('stash');

        // Rebuild stash grid only if contents have changed (prevents hover flickering)
        const currentHash = this.computeStashHash();
        if (currentHash !== this.lastStashHash) {
            this.lastStashHash = currentHash;
            this.uiBuilder.buildStashUI();
        }
    }

    /**
     * Update Processing Plant item grid and crafting details panel
     * Performance optimized: only updates when Processing Plant is visible
     */
    updateProcessingPlant() {
        // Skip if Processing Plant is not currently visible
        if (!this.navigationManager || !this.navigationManager.isFacilityActive('processing')) {
            return;
        }

        // Update item card availability states (active/inactive)
        this.uiBuilder.updateItemCardAvailability();

        // Update crafting details panel if an item is selected
        this.uiBuilder.updateCraftingDetailsIfOpen();
    }

    /**
     * Update trading stock display
     */
    updateTrading() {
        const allItems = dataLoader.getAllItems();
        for (const itemId in allItems) {
            const stockEl = document.getElementById(`${itemId}-stock`);
            if (stockEl) {
                stockEl.textContent = this.stashManager.getItemQuantity(itemId);
            }
        }
    }

    /**
     * Update Product Management panel for a specific facility
     * Called when area placement or worker assignment changes
     */
    updateProductionPanelForFacility(facilityId) {
        // Update Production List Grid (comprehensive production info including yields)
        // Call productGridUI method if available to refresh the production list display
        if (window.game?.productGridUI) {
            window.game.productGridUI.updateProductionListDisplay(facilityId);
        }

        // Fallback: Update legacy Production List (items produced by placed areas)
        const productionList = document.getElementById(`${facilityId}-production-list`);
        if (productionList) {
            const placements = this.gameState.gridPlacements[facilityId]?.placements || [];
            const uniqueItems = new Set();

            for (const placement of placements) {
                const area = dataLoader.getProductArea(placement.areaId);
                if (area && area.productItem) {
                    uniqueItems.add(area.productItem.itemId);
                }
            }

            productionList.innerHTML = '';
            if (uniqueItems.size === 0) {
                productionList.innerHTML = '<p class="empty-message">No zones placed</p>';
            } else {
                uniqueItems.forEach(itemId => {
                    const item = dataLoader.getItem(itemId);
                    const itemName = item ? item.name : itemId;
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'production-item';
                    itemDiv.textContent = itemName;
                    productionList.appendChild(itemDiv);
                });
            }
        }

        // Update Inventory List (grid-based storage display with Simplified Standard Display Format)
        const inventoryList = document.getElementById(`${facilityId}-inventory-list`);
        if (inventoryList) {
            const maxSlots = this.facilityStorageManager.getStorageSlots(facilityId);
            const items = this.facilityStorageManager.getAllItems(facilityId);

            // Only rebuild slots if the number changed
            const currentSlotCount = inventoryList.querySelectorAll('.inventory-item').length;
            if (currentSlotCount !== maxSlots) {
                inventoryList.innerHTML = '';
                // Create all slots
                for (let i = 0; i < maxSlots; i++) {
                    const slotDiv = document.createElement('div');
                    slotDiv.className = 'inventory-item';
                    slotDiv.dataset.slotIndex = i;
                    inventoryList.appendChild(slotDiv);
                }
            }

            // Update slot contents using Simplified Item View standard
            const slots = inventoryList.querySelectorAll('.inventory-item');
            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                if (i < items.length) {
                    const item = items[i];
                    const itemData = item.item;
                    const itemGrade = itemData?.grade || 'common';
                    const itemName = itemData?.name || item.itemId;
                    const firstLetter = itemName.charAt(0).toUpperCase();

                    slot.classList.add('occupied', 'simplified-item-view');
                    slot.classList.remove('empty');
                    // Remove all grade classes, then add the current one
                    slot.classList.remove('grade-common', 'grade-uncommon', 'grade-rare', 'grade-epic', 'grade-legendary');
                    slot.classList.add(`grade-${itemGrade}`);
                    slot.title = itemName; // Tooltip shows full name on hover
                    slot.style.cursor = 'pointer';

                    // Render using Simplified Item View structure
                    slot.innerHTML = `
                        <div class="simplified-item-icon">${firstLetter}</div>
                        <span class="simplified-item-quantity">×${item.quantity}</span>
                    `;

                    // Add click handler to show item details modal (only attach once per slot)
                    if (!slot.hasAttribute('data-click-handler-attached')) {
                        slot.setAttribute('data-click-handler-attached', 'true');
                        slot.addEventListener('click', (e) => {
                            e.stopPropagation();
                            // Get current item in this slot
                            const currentItem = this.facilityStorageManager.getAllItems(facilityId)[parseInt(slot.dataset.slotIndex)];
                            if (currentItem) {
                                window.game?.showItemInfoModal([{
                                    itemId: currentItem.itemId,
                                    itemName: currentItem.item?.name || currentItem.itemId,
                                    quantity: currentItem.quantity
                                }], 0);
                            }
                        });
                    }
                } else {
                    slot.classList.remove('occupied', 'simplified-item-view');
                    slot.classList.add('empty');
                    slot.classList.remove('grade-common', 'grade-uncommon', 'grade-rare', 'grade-epic', 'grade-legendary');
                    slot.title = '';
                    slot.innerHTML = '';
                    slot.style.cursor = 'default';
                    slot.removeAttribute('data-click-handler-attached');
                }
            }
        }

        // Update Capacity Meter - display as "Used Slots / Max Slots"
        const capacityFill = document.getElementById(`${facilityId}-capacity-fill`);
        const capacityText = document.getElementById(`${facilityId}-capacity-text`);

        if (capacityFill && capacityText) {
            const maxSlots = this.facilityStorageManager.getStorageSlots(facilityId);
            const usedSlots = this.facilityStorageManager.getUsedSlotCount(facilityId);

            const percentage = maxSlots > 0 ? (usedSlots / maxSlots * 100) : 0;
            capacityFill.style.width = `${percentage.toFixed(1)}%`;
            capacityText.textContent = `${usedSlots}/${maxSlots}`;

            // Change color based on fullness
            if (percentage >= 100) {
                capacityFill.style.background = '#f44336'; // Red when full
            } else if (percentage >= 75) {
                capacityFill.style.background = '#ff9800'; // Orange when nearly full
            } else {
                capacityFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)'; // Green
            }
        }
    }

    /**
     * Update Product Management panel for production facilities
     */
    updateProductManagement() {
        const productionFacilities = ['farm', 'mine', 'ranch', 'fishery'];

        for (const facilityId of productionFacilities) {
            this.updateProductionPanelForFacility(facilityId);
        }
    }

    /**
     * Update zone production progress bars in real-time
     * Uses placement IDs to correctly map UI elements to zone timers
     */
    updateZoneProgress() {
        // Find all placed area elements and update their progress bars
        const placedAreas = document.querySelectorAll('.placed-area');

        for (const areaElement of placedAreas) {
            const facilityId = areaElement.dataset.facilityId;
            const areaId = areaElement.dataset.areaId;
            const placementId = areaElement.dataset.placementId;

            if (!placementId) continue;

            // Use placement ID from data attribute to construct zone key
            const zoneKey = `${facilityId}_${areaId}_${placementId}`;

            // Check if zone still exists and has workers assigned
            const assignedWorkers = this.gameState.areaWorkerAssignments[zoneKey] || [];
            const area = dataLoader.getProductArea(areaId);
            if (!area) continue;

            const requiredWorkers = area.workers || 0;
            const hasWorkers = assignedWorkers.length >= requiredWorkers;

            // Check if zone is halted due to full storage or other reasons
            const isZoneHalted = this.gameState.haltedZones && this.gameState.haltedZones[zoneKey];

            // Only update timer if zone has workers; otherwise show full time
            const timer = hasWorkers ? (this.gameState.zoneTimers[zoneKey] || 0) : 0;
            const productionTimeMs = (area.cooltime || 10) * 1000;
            const progress = hasWorkers ? Math.min((timer / productionTimeMs) * 100, 100) : 0;

            // Calculate remaining time
            const remainingMs = hasWorkers ? Math.max(productionTimeMs - timer, 0) : productionTimeMs;
            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
            const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Update progress bar
            const progressFill = areaElement.querySelector('.zone-progress-fill');
            if (progressFill) {
                progressFill.style.width = `${progress.toFixed(1)}%`;

                // Apply or remove halted zone styling (red warning state)
                if (isZoneHalted) {
                    progressFill.classList.add('progress-bar-full');
                } else {
                    progressFill.classList.remove('progress-bar-full');
                }
            }

            // Update time text and percentage text
            const timeElement = areaElement.querySelector('.zone-time');
            const percentageElement = areaElement.querySelector('.zone-percentage');

            if (isZoneHalted) {
                // Show "Storage Full" message when zone is halted
                if (timeElement) {
                    timeElement.textContent = 'Storage';
                }
                if (percentageElement) {
                    percentageElement.textContent = 'Full';
                }
            } else {
                // Show normal time and percentage when zone is actively producing
                if (timeElement) {
                    timeElement.textContent = timeStr;
                }
                if (percentageElement) {
                    percentageElement.textContent = `${progress.toFixed(0)}%`;
                }
            }
        }
    }

    /**
     * Update lodge worker displays
     */
    updateLodgeDisplay() {
        if (!this.gameState.workers) return;

        const workers = this.gameState.workers;

        // Get the maximum worker limit from Lodge upgrade data
        const lodgeLevel = this.gameState.facilities.lodge.level;
        const lodgeUpgrade = dataLoader.getUpgradeCost('lodge', lodgeLevel);
        const maxWorkers = lodgeUpgrade && lodgeUpgrade.maxWorkers ? lodgeUpgrade.maxWorkers : 5;

        // Update counts
        const totalEl = document.getElementById('lodge-total-workers');
        if (totalEl) totalEl.textContent = workers.hired.length;

        const availableEl = document.getElementById('lodge-available-workers');
        if (availableEl) {
            const available = workers.hired.filter(w => !w.assignedTo).length;
            availableEl.textContent = available;
        }

        const pendingCountEl = document.getElementById('lodge-pending-count');
        if (pendingCountEl) pendingCountEl.textContent = workers.pending.length;

        const pendingMaxEl = document.getElementById('lodge-pending-max');
        if (pendingMaxEl) pendingMaxEl.textContent = workers.maxPending;

        // Update nav count in sidebar
        const pendingNavCountEl = document.getElementById('lodge-pending-count-nav');
        if (pendingNavCountEl) pendingNavCountEl.textContent = workers.pending.length;

        const pendingNavMaxEl = document.getElementById('lodge-pending-max-nav');
        if (pendingNavMaxEl) pendingNavMaxEl.textContent = `/${workers.maxPending}`;

        const hiredCountEl = document.getElementById('lodge-hired-count');
        if (hiredCountEl) hiredCountEl.textContent = workers.hired.length;

        const hiredMaxEl = document.getElementById('lodge-hired-max');
        if (hiredMaxEl) hiredMaxEl.textContent = maxWorkers;

        // Update nav count in sidebar
        const hiredNavCountEl = document.getElementById('lodge-hired-count-nav');
        if (hiredNavCountEl) hiredNavCountEl.textContent = workers.hired.length;

        const hiredNavMaxEl = document.getElementById('lodge-hired-max-nav');
        if (hiredNavMaxEl) hiredNavMaxEl.textContent = `/${maxWorkers}`;

        // Update pending workers list (avoid DOM recreation to prevent hover jitter)
        const pendingContainer = document.getElementById('lodge-pending-workers');
        if (pendingContainer) {
            // Always show worker cards or empty slots, never show "no workers" text
            this.updatePendingWorkersWithSlots(pendingContainer, workers);
        }

        // Update hired workers roster (avoid DOM recreation to prevent hover jitter)
        const hiredContainer = document.getElementById('lodge-hired-workers');
        if (hiredContainer) {
            hiredContainer.style.display = '';
            this.updateHiredWorkersWithSlots(hiredContainer, workers);
        }

        // Update arrival timer
        this.updateArrivalTimer();
    }

    /**
     * Build current state for a facility's navigation indicators
     * Returns object with upgradeAvailable and statusBadge
     */
    getIndicatorState(facilityId) {
        const state = { upgradeAvailable: false, statusBadge: '' };

        // Check if upgrade is available
        if (typeof game !== 'undefined' && game.upgradeSystem) {
            const canUpgradeResult = game.upgradeSystem.canUpgrade(facilityId);
            state.upgradeAvailable = canUpgradeResult.canUpgrade;
        }

        // Get facility-specific indicator
        if (facilityId === 'stash') {
            const usedSlots = this.gameState.stash.slots.filter(s => s !== null).length;
            const capacity = this.gameState.stash.capacity;
            const percentage = capacity > 0 ? (usedSlots / capacity * 100) : 0;
            let badgeClass = 'status-badge';
            if (percentage >= 100) {
                badgeClass += ' critical';
            } else if (percentage >= 75) {
                badgeClass += ' warning';
            }
            state.statusBadge = `<span class="${badgeClass}">${usedSlots}/${capacity}</span>`;
        } else if (facilityId === 'lodge') {
            const pending = this.gameState.workers.pending.length;
            const maxPending = this.gameState.workers.maxPending;
            state.statusBadge = `<span class="status-badge">${pending}/${maxPending}</span>`;
        } else if (facilityId === 'trading') {
            const activeOrders = this.gameState.tradingPost.activeOrders.length;
            const maxSlots = this.gameState.tradingPost.maxQueueSlots;
            const percentage = maxSlots > 0 ? (activeOrders / maxSlots * 100) : 0;
            let badgeClass = 'status-badge';
            if (percentage >= 100) {
                badgeClass += ' critical';
            } else if (percentage >= 75) {
                badgeClass += ' warning';
            }
            state.statusBadge = `<span class="${badgeClass}">${activeOrders}/${maxSlots}</span>`;
        } else if (['farm', 'mine', 'ranch', 'fishery'].includes(facilityId)) {
            const maxSlots = this.facilityStorageManager.getStorageSlots(facilityId);
            const usedSlots = this.facilityStorageManager.getUsedSlotCount(facilityId);
            const percentage = maxSlots > 0 ? (usedSlots / maxSlots * 100) : 0;
            let badgeClass = 'status-badge';
            if (percentage >= 100) {
                badgeClass += ' critical';
            } else if (percentage >= 75) {
                badgeClass += ' warning';
            }
            state.statusBadge = `<span class="${badgeClass}">${usedSlots}/${maxSlots}</span>`;
        }

        return state;
    }

    /**
     * Clear the navigation indicator cache
     * Call this when navigation is reinitialized to force indicator updates
     */
    clearNavigationIndicatorCache() {
        this.lastNavigationIndicatorState = {};
    }

    /**
     * Check if indicator state has changed from last update
     * Returns true if state differs
     */
    indicatorStateChanged(facilityId, newState) {
        const oldState = this.lastNavigationIndicatorState[facilityId];
        if (!oldState) return true; // First time, always update
        return oldState.upgradeAvailable !== newState.upgradeAvailable ||
               oldState.statusBadge !== newState.statusBadge;
    }

    /**
     * Update navigation status indicators for all facilities
     * Performance optimized: only updates DOM when state actually changes
     * Shows upgrade availability, storage status, and worker recruitment status
     */
    updateNavigationIndicators() {
        // Get all facility IDs from gameState
        const facilityIds = [
            'stash',
            'lodge',
            'farm',
            'mine',
            'ranch',
            'fishery',
            'processing',
            'trading'
        ];

        for (const facilityId of facilityIds) {
            const indicatorContainer = document.getElementById(`${facilityId}-nav-indicators`);
            if (!indicatorContainer) continue;

            // Get current state
            const currentState = this.getIndicatorState(facilityId);

            // Only update DOM if state changed
            if (this.indicatorStateChanged(facilityId, currentState)) {
                let indicatorHTML = '';
                if (currentState.upgradeAvailable) {
                    indicatorHTML += '<span class="upgrade-indicator">U</span>';
                }
                indicatorHTML += currentState.statusBadge;

                indicatorContainer.innerHTML = indicatorHTML;
                this.lastNavigationIndicatorState[facilityId] = currentState;
            }
        }
    }

    /**
     * Update Add Facility button state based on resource availability
     */
    updateAddFacilityButtonState() {
        if (!this.navigationManager) return;
        this.navigationManager.updateAddFacilityButtonState();
    }

    /**
     * Update worker cards efficiently by reusing DOM elements
     * Prevents hover jitter from constant DOM recreation
     */
    updateWorkerCards(container, workers, type) {
        const existingCards = container.querySelectorAll('.worker-card');

        // Remove cards for workers that no longer exist
        const workerIds = new Set(workers.map(w => w.id));
        existingCards.forEach(card => {
            const workerId = card.getAttribute('data-worker-id');
            if (!workerIds.has(workerId)) {
                card.remove();
            }
        });

        // Update or create cards for each worker
        workers.forEach((worker) => {
            let card = container.querySelector(`.worker-card[data-worker-id="${worker.id}"]`);

            if (!card) {
                // Create new card if it doesn't exist
                const cardHtml = type === 'pending'
                    ? this.uiBuilder.buildPendingWorkerCard(worker)
                    : this.uiBuilder.buildHiredWorkerCard(worker);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtml;
                card = tempDiv.firstElementChild;
                container.appendChild(card);
            } else if (type === 'hired') {
                // Only update minimal state: assignment status and facility name
                // Do NOT rebuild the entire card - this prevents hover jitter
                card.className = `worker-card ${worker.assignedTo ? 'assigned' : ''}`;

                const assignmentDiv = card.querySelector('.worker-assignment');
                if (assignmentDiv) {
                    let facilityName = 'Unassigned';
                    if (worker.assignedTo) {
                        const [facilityId, areaId] = worker.assignedTo.split('_');
                        const facility = dataLoader.getFacility(facilityId);
                        if (facility) {
                            const area = dataLoader.getProductArea(areaId);
                            facilityName = area ? `${facility.name} - ${areaId}` : facility.name;
                        }
                    }
                    assignmentDiv.textContent = worker.assignedTo ? `Assigned to: ${facilityName}` : 'Unassigned';
                }
            }
        });
    }

    /**
     * Update pending workers with empty slot placeholders
     * Shows worker cards and fills remaining capacity with empty slots
     */
    updatePendingWorkersWithSlots(container, workers) {
        const maxPending = workers.maxPending;
        const pendingCount = workers.pending.length;

        // First, update existing worker cards
        this.updateWorkerCards(container, workers.pending, 'pending');

        // Remove existing empty slots
        const existingSlots = container.querySelectorAll('.worker-slot-empty');
        existingSlots.forEach(slot => slot.remove());

        // Add empty slots for remaining capacity
        const slotsNeeded = maxPending - pendingCount;
        for (let i = 0; i < slotsNeeded; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'worker-card worker-slot-empty';
            emptySlot.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #555; font-size: 2em;">
                    <span style="opacity: 0.3;">⊘</span>
                </div>
            `;
            container.appendChild(emptySlot);
        }
    }

    /**
     * Update hired workers with empty slot placeholders
     * Shows hired worker cards and fills remaining capacity with empty slots
     * Displays empty slots to represent available hiring capacity
     */
    updateHiredWorkersWithSlots(container, workers) {
        // Get the maximum worker limit from Lodge upgrade data
        const lodgeLevel = this.gameState.facilities.lodge.level;
        const lodgeUpgrade = dataLoader.getUpgradeCost('lodge', lodgeLevel);
        const maxWorkers = lodgeUpgrade && lodgeUpgrade.maxWorkers ? lodgeUpgrade.maxWorkers : 5;
        
        const hiredCount = workers.hired.length;

        // First, update existing worker cards
        this.updateWorkerCards(container, workers.hired, 'hired');

        // Remove existing empty slots
        const existingSlots = container.querySelectorAll('.worker-slot-empty');
        existingSlots.forEach(slot => slot.remove());

        // Add empty slots for remaining capacity
        const slotsNeeded = maxWorkers - hiredCount;
        for (let i = 0; i < slotsNeeded; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'worker-card worker-slot-empty';
            emptySlot.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #555; font-size: 2em;">
                    <span style="opacity: 0.3;">⊘</span>
                </div>
            `;
            container.appendChild(emptySlot);
        }
    }

    /**
     * Update arrival timer display
     * Display always shows baseline duration (stable at any game speed)
     * But countdown ticks at speed-accelerated rate
     */
    updateArrivalTimer() {
        const timerEl = document.getElementById('lodge-arrival-timer');
        const progressBarEl = document.getElementById('lodge-arrival-progress');
        if (!timerEl || !progressBarEl || !this.gameState.workers) return;

        const workers = this.gameState.workers;

        // Check if queue is full - this takes precedence over timer display
        if (workers.pending.length >= workers.maxPending) {
            timerEl.textContent = 'Queue Full';
            progressBarEl.style.width = '100%';
            progressBarEl.style.background = '#e74c3c'; // Red when full (overrides gradient)
            return;
        }

        // Reset to normal gradient when not full
        progressBarEl.style.background = '';

        // Ensure scaledElapsed is initialized (for save/load compatibility)
        if (typeof workers.scaledElapsed !== 'number') {
            workers.scaledElapsed = 0;
        }

        // Use game-speed-adjusted elapsed time (not real elapsed time)
        const scaledElapsed = workers.scaledElapsed;

        // Remaining time is always relative to the base interval
        // Display will show the same duration regardless of game speed
        const remaining = Math.max(0, workers.arrivalInterval - scaledElapsed);

        // Format time as hh:mm:ss
        const totalSeconds = Math.ceil(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Update progress bar - show progress from 0 to arrival interval
        const progress = (scaledElapsed / workers.arrivalInterval) * 100;
        progressBarEl.style.width = `${Math.min(progress, 100)}%`;
    }

    /**
     * Update worker assignments for a facility
     * Called regularly to update WorkerGrid displays and idle worker list
     */
    updateWorkerAssignments(facilityId, productGridUI) {
        if (!productGridUI) return;

        // Update idle worker count in left panel
        const idleWorkerList = document.querySelector('.idle-worker-list');
        if (idleWorkerList) {
            const currentWorkerCount = idleWorkerList.querySelectorAll('.idle-worker-card').length;
            const actualIdleWorkers = window.game?.workerSystem?.getAvailableWorkers()?.length || 0;

            // Only rebuild if worker count changed
            if (currentWorkerCount !== actualIdleWorkers) {
                const panel = document.querySelector('.idle-workers-panel');
                if (panel) {
                    const newPanel = productGridUI.createIdleWorkersPanel(facilityId);
                    panel.replaceWith(newPanel);
                }
            }
        }

        // Update each WorkerGrid display
        const workerGrids = document.querySelectorAll('.worker-grid-overlay');
        for (const grid of workerGrids) {
            const zoneKey = grid.dataset.zoneKey;
            if (!zoneKey) continue;

            const slots = grid.querySelectorAll('.worker-slot');
            const assignedWorkers = this.gameState.areaWorkerAssignments[zoneKey] || [];

            // Update each slot
            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                if (i < assignedWorkers.length) {
                    const workerId = assignedWorkers[i];
                    const worker = this.gameState.workers.hired.find(w => w.id === workerId);
                    if (worker) {
                        // Check if slot content changed
                        const hasPortrait = slot.querySelector('.worker-portrait');
                        if (!hasPortrait) {
                            productGridUI.updateWorkerSlot(slot, worker);
                        }
                    }
                } else {
                    // Slot should be empty
                    const hasPortrait = slot.querySelector('.worker-portrait');
                    if (hasPortrait) {
                        slot.innerHTML = '<span class="empty-slot-icon">+</span>';
                    }
                }
            }

            // Update stat bonus display
            productGridUI.updateStatBonusDisplay(zoneKey);

            // Update visual indicator for understaffed areas
            const [fId, areaId] = zoneKey.split('_').slice(0, 2);
            const area = dataLoader.getProductArea(areaId);
            const placedArea = grid.closest('.placed-area');

            if (placedArea && area) {
                const requiredWorkers = area.workers || 0;
                if (assignedWorkers.length < requiredWorkers) {
                    placedArea.classList.add('needs-workers');
                } else {
                    placedArea.classList.remove('needs-workers');
                }
            }
        }
    }

    /**
     * Update only the EXP display for a specific worker (targeted update, no DOM recreation)
     * Called when a production cycle completes to update the progress bar and EXP text
     * This prevents hover jitter by only updating the specific DOM elements that changed
     */
    updateWorkerExpDisplay(workerId) {
        const card = document.querySelector(`.worker-card[data-worker-id="${workerId}"]`);
        if (!card) return;

        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
        if (!worker) return;

        const maxLevel = dataLoader.getMaxLevelForGrade(worker.grade);
        const isMaxLevel = dataLoader.isWorkerAtMaxLevel(worker);
        const currentExp = worker.exp || 0;
        const requiredExp = isMaxLevel ? 100 : dataLoader.getExpRequiredForLevel(worker.level + 1);
        const expPercentage = isMaxLevel ? 100 : Math.floor((currentExp / requiredExp) * 100);

        // Find and update the EXP bar container
        const expBarContainer = card.querySelector('.worker-exp-bar-container');
        if (expBarContainer) {
            if (isMaxLevel) {
                // Max level displays the bar at 100% with 0 / 0 EXP
                expBarContainer.classList.add('max-level');
                
                // Ensure the bar structure is in place
                let expBar = expBarContainer.querySelector('.worker-exp-bar');
                if (!expBar) {
                    expBarContainer.innerHTML = `
                        <div class="worker-exp-bar">
                            <div class="worker-exp-bar-fill" style="width: 100%"></div>
                            <div class="worker-exp-overlay">
                                <span class="exp-level">Lv ${maxLevel} / ${maxLevel}</span>
                                <span class="exp-progress">0 / 0</span>
                            </div>
                        </div>
                    `;
                } else {
                    // Update existing bar to show 100% and 0 / 0
                    const expBarFill = expBarContainer.querySelector('.worker-exp-bar-fill');
                    if (expBarFill) {
                        expBarFill.style.width = '100%';
                    }

                    const expOverlay = expBarContainer.querySelector('.worker-exp-overlay');
                    if (expOverlay) {
                        const expLevelSpan = expOverlay.querySelector('.exp-level');
                        const expProgressSpan = expOverlay.querySelector('.exp-progress');
                        
                        if (expLevelSpan) {
                            expLevelSpan.textContent = `Lv ${maxLevel} / ${maxLevel}`;
                        }
                        if (expProgressSpan) {
                            expProgressSpan.textContent = '0 / 0';
                        }
                    }
                }
            } else {
                expBarContainer.classList.remove('max-level');
                
                // Update the progress bar
                const expBarFill = expBarContainer.querySelector('.worker-exp-bar-fill');
                if (expBarFill) {
                    expBarFill.style.width = `${expPercentage}%`;
                }

                // Update the overlay text
                const expOverlay = expBarContainer.querySelector('.worker-exp-overlay');
                if (expOverlay) {
                    const expLevelSpan = expOverlay.querySelector('.exp-level');
                    const expProgressSpan = expOverlay.querySelector('.exp-progress');
                    
                    if (expLevelSpan) {
                        expLevelSpan.textContent = `Lv ${worker.level} / ${maxLevel}`;
                    }
                    if (expProgressSpan) {
                        expProgressSpan.textContent = `${currentExp} / ${requiredExp}`;
                    }
                }
            }
        }

        // Update worker level display (for level-ups)
        const levelDisplay = card.querySelector('.worker-level');
        if (levelDisplay) {
            levelDisplay.textContent = `${worker.level} / ${maxLevel}`;
        }

        // Also update stats if bonus changed (minimal update)
        const statsContainer = card.querySelector('.worker-stats');
        if (statsContainer && worker.baseStats) {
            const statLabels = ['str', 'agi', 'int', 'end'];
            const statDivs = statsContainer.querySelectorAll('.worker-stat');

            statDivs.forEach((statDiv, index) => {
                if (index >= statLabels.length) return;

                const statName = statLabels[index];
                const currentValue = worker.stats[statName];
                const baseValue = worker.baseStats[statName] || currentValue;
                const bonus = Math.max(0, currentValue - baseValue);

                const valueSpan = statDiv.querySelector('.worker-stat-value');
                if (valueSpan) {
                    const bonusHtml = bonus > 0 ? ` <span class="stat-bonus">(+${bonus})</span>` : '';
                    valueSpan.innerHTML = `${currentValue}${bonusHtml}`;
                }
            });
        }
    }

    /**
     * Update Trading Post UI
     */
    updateTradingPost() {
        if (!this.navigationManager.isFacilityActive('trading')) {
            return;
        }

        // Update order count
        const orderCount = document.getElementById('active-order-count');
        const maxSlots = document.getElementById('max-order-slots');
        if (orderCount && maxSlots) {
            orderCount.textContent = this.gameState.tradingPost.activeOrders.length;
            maxSlots.textContent = this.gameState.tradingPost.maxQueueSlots;
        }

        // Update level display
        const levelDisplay = document.getElementById('trading-level-display');
        if (levelDisplay) {
            levelDisplay.textContent = `Lv ${this.gameState.tradingPost.level}`;
        }

        // Update upgrade button state
        this.updateTradingUpgradeButton();

        // Update arrival timer
        this.updateTradingArrivalTimer();

        // Update card availability (reactive buttons and quantities)
        this.uiBuilder.updateOrderCardAvailability();

        // Rebuild cards if order count changed or capacity upgraded
        // CRITICAL: Check number of order cards (NOT total children), since total can stay same
        // Example: 1 order + 2 empty slots = 3 children; 2 orders + 1 empty slot = still 3 children
        const container = document.getElementById('trading-orders-grid');
        const maxQueueSlots = this.gameState.tradingPost.maxQueueSlots;
        const activeOrderCount = this.gameState.tradingPost.activeOrders.length;

        if (container) {
            // Count existing order cards (cards with data-order-id attribute)
            const currentOrderCards = container.querySelectorAll('.trading-order-card[data-order-id]').length;

            // Rebuild if order card count changed OR if capacity was upgraded (maxQueueSlots changed)
            if (currentOrderCards !== activeOrderCount || maxQueueSlots !== this.lastMaxQueueSlots) {
                if (maxQueueSlots !== this.lastMaxQueueSlots) {
                    this.lastMaxQueueSlots = maxQueueSlots;
                    console.log(`[Trading Post UI] Capacity upgraded: ${this.lastMaxQueueSlots - (maxQueueSlots - this.lastMaxQueueSlots)} -> ${maxQueueSlots}. Rebuilding grid...`);
                } else {
                    console.log(`[Trading Post UI] Order count changed: ${currentOrderCards} -> ${activeOrderCount}. Rebuilding grid...`);
                }
                this.uiBuilder.buildTradingPostUI();
            } else {
                // Update lastMaxQueueSlots on first load
                if (this.lastMaxQueueSlots === 0) {
                    this.lastMaxQueueSlots = maxQueueSlots;
                }
            }
        }
    }

    /**
     * Update Trading Post upgrade button state
     * Uses same validation as other facilities via canUpgrade()
     */
    updateTradingUpgradeButton() {
        const upgradeBtn = document.getElementById('trading-upgrade-btn');
        if (!upgradeBtn) return;

        const currentLevel = this.gameState.tradingPost.level;
        const nextUpgrade = dataLoader.getTradingUpgrade(currentLevel + 1);

        // If max level reached, disable button since there's nothing to upgrade to
        if (!nextUpgrade) {
            upgradeBtn.disabled = true;
            upgradeBtn.title = 'Max level reached';
            upgradeBtn.classList.remove('insufficient-resources');
            return;
        }

        // Button is ALWAYS clickable so player can open the modal and see requirements
        // Remove the disabled attribute entirely to ensure it's always clickable
        upgradeBtn.disabled = false;
        upgradeBtn.removeAttribute('disabled');

        // Use upgradeSystem.canUpgrade for consistent validation logic
        // This ensures facility-level requirements are checked BEFORE item requirements
        const canUpgradeResult = (typeof game !== 'undefined' && game.upgradeSystem)
            ? game.upgradeSystem.canUpgrade('trading')
            : { canUpgrade: false };

        // Update button visual state (but keep it clickable)
        if (canUpgradeResult.canUpgrade) {
            upgradeBtn.classList.remove('insufficient-resources');
            upgradeBtn.style.backgroundColor = '#2ecc71'; // Green
            upgradeBtn.title = 'Upgrade Trading Post';
        } else {
            upgradeBtn.classList.add('insufficient-resources');
            upgradeBtn.style.backgroundColor = '#95a5a6'; // Gray
            upgradeBtn.title = 'Click to view upgrade requirements';
        }
    }

    /**
     * Update Trading Post arrival timer
     * Text is now displayed inside the progress bar as an overlay
     */
    updateTradingArrivalTimer() {
        const timerText = document.getElementById('trading-arrival-text');
        const progressBar = document.getElementById('trading-arrival-progress');
        if (!timerText || !progressBar) return;

        const state = this.gameState.tradingPost;

        // Check if queue is full - this takes precedence over timer display
        if (state.isPaused) {
            timerText.textContent = 'Queue Full';
            progressBar.style.width = '100%';
            progressBar.style.background = '#e74c3c'; // Red when full (overrides gradient)
            return;
        }

        // Reset to normal color when not full
        progressBar.style.background = '';

        // Calculate remaining time
        const remaining = state.arrivalInterval - state.scaledElapsed;
        const seconds = Math.ceil(remaining / 1000);

        // Format time (HH:MM:SS)
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        timerText.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // Update progress bar width and color
        const progress = (state.scaledElapsed / state.arrivalInterval) * 100;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
        progressBar.style.backgroundColor = '#3498db'; // Blue when counting down
    }
}
