/**
 * Game Loop Manager
 * Orchestrates all game systems and manages the main game loop
 */
class GameLoopManager {
    constructor() {
        // Initialize all systems
        this.gameState = new GameState();
        this.stashManager = new StashManager(this.gameState);
        this.facilityStorageManager = new FacilityStorageManager(this.gameState);
        this.workerGridSystem = new WorkerGridSystem(this.gameState);
        this.productGridSystem = new ProductGridSystem(this.gameState, this.workerGridSystem);
        this.productionSystem = new ProductionSystem(this.gameState, this.productGridSystem, this.facilityStorageManager);
        this.workerSystem = new WorkerSystem(this.gameState, this.workerGridSystem);
        this.craftingSystem = new CraftingSystem(this.stashManager, this.gameState);
        this.tradingSystem = new TradingSystem(this.gameState, this.stashManager);
        this.tradingPostSystem = new TradingPostSystem(this.gameState, this.stashManager);
        this.upgradeSystem = new UpgradeSystem(this.gameState, this.stashManager, this.facilityStorageManager);
        this.upgradeStatistics = new UpgradeStatistics(this.gameState, this.stashManager, dataLoader);

        // Initialize UI systems
        this.navigationManager = new NavigationManager(this.gameState, this.productGridSystem);
        this.uiBuilder = new UIBuilder(this.gameState, this.stashManager, this, this.productGridSystem, this.workerGridSystem, this.facilityStorageManager);
        this.navigationManager.uiBuilder = this.uiBuilder;
        this.uiUpdater = new UIUpdater(this.gameState, this.stashManager, this.uiBuilder, this.facilityStorageManager, this.navigationManager);
    }

    /**
     * Initialize the entire game
     */
    async init() {
        try {
            // Initialize game state
            const stateReady = await this.gameState.initializeState();
            if (!stateReady) {
                alert('Failed to initialize game state. Check console for errors.');
                return false;
            }

            // Initialize worker system
            this.workerSystem.initialize();

            // Initialize trading post system
            this.tradingPostSystem.initialize();

            // Restore grid placements from saved data
            for (const facilityId in this.gameState.gridPlacements) {
                const gridData = this.gameState.gridPlacements[facilityId];
                this.productGridSystem.gridState[facilityId] = {
                    width: gridData.width || 10,
                    height: gridData.height || 10,
                    placements: [...(gridData.placements || [])]
                };
            }

            // Restore saved worker grids from saved data
            if (this.gameState.workerGrids) {
                this.workerGridSystem.workerGrids = this.gameState.workerGrids;
            } else {
                // Initialize worker grids for all placed production areas
                for (const facilityId in this.gameState.gridPlacements) {
                    const placements = this.gameState.gridPlacements[facilityId].placements || [];
                    for (let i = 0; i < placements.length; i++) {
                        const placement = placements[i];
                        const area = DATA.productArea[placement.areaId];
                        if (area) {
                            const zoneKey = `${facilityId}_${placement.areaId}_${i}`;
                            this.workerGridSystem.initializeWorkerGrid(zoneKey, area.gridX, Math.max(1, area.gridY - 1), area.workers);
                        }
                    }
                }
            }

            // Initialize navigation
            this.navigationManager.initializeNavigation();

            // Build UI
            this.uiBuilder.buildDynamicUI();

            // Set up event callback for when workers gain EXP
            // This allows targeted UI updates without rebuilding entire worker cards
            this.productionSystem.onWorkerExpGained = (workerId) => {
                this.uiUpdater.updateWorkerExpDisplay(workerId);
            };

            // Start game loop
            this.gameState.gameLoopInterval = setInterval(() => this.gameLoop(), 100);

            // Update initial UI
            this.uiUpdater.updateUI();

            console.log('Game initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing game:', error);
            return false;
        }
    }

    /**
     * Main game loop
     */
    gameLoop() {
        const scaledDeltaTime = this.gameState.updateTiming();
        this.productionSystem.updateProduction(scaledDeltaTime);
        this.workerSystem.updateWorkerArrivals(scaledDeltaTime);
        this.tradingPostSystem.updateOrderArrivals(scaledDeltaTime);
        this.uiUpdater.updateUI();
    }

    /**
     * Public API methods called from HTML
     */

    /**
     * Hire a pending worker (called from HTML onclick handler)
     */
    hireWorker(workerId) {
        if (this.workerSystem.hireWorker(workerId)) {
            this.uiUpdater.updateUI();
            return true;
        }
        return false;
    }

    /**
     * Dismiss a pending worker from the hiring queue
     */
    dismissWorker(workerId) {
        if (this.workerSystem.dismissWorker(workerId)) {
            this.uiUpdater.updateUI();
            return true;
        }
        return false;
    }

    /**
     * Unassign worker from facility
     */
    unassignWorker(workerId) {
        if (this.workerSystem.unassignWorker(workerId)) {
            this.uiUpdater.updateUI();
            return true;
        }
        return false;
    }

    assignWorkers(facilityId) {
        const inputElement = document.getElementById(`${facilityId}-input`);
        const amountToAssign = parseInt(inputElement.value) || 0;

        if (this.workerSystem.assignWorkers(facilityId, amountToAssign)) {
            inputElement.value = 0;
            this.uiUpdater.updateUI();
        }
    }

    adjustWorkers(facilityId, delta) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility) return;

        const newAmount = Math.max(0, facility.assignedWorkers + delta);
        if (this.workerSystem.assignWorkers(facilityId, newAmount)) {
            this.uiUpdater.updateUI();
        }
    }

    craft(outputItemId) {
        if (this.craftingSystem.craft(outputItemId)) {
            this.uiUpdater.updateUI();
        }
    }

    sell(itemId) {
        const inputElement = document.getElementById(`${itemId}-sell-input`);
        const amountToSell = parseInt(inputElement.value) || 0;

        if (this.tradingSystem.sell(itemId, amountToSell)) {
            inputElement.value = 0;
            this.uiUpdater.updateUI();
        }
    }

    upgradeFacility(facilityId) {
        if (this.upgradeSystem.upgradeFacility(facilityId)) {
            // Update grid dimensions if this is a product facility
            const facility = this.gameState.facilities[facilityId];
            if (facility) {
                const facilityData = dataLoader.getFacility(facilityId);
                if (facilityData && facilityData.type === 'product') {
                    const { x: gridWidth, y: gridHeight } = dataLoader.getGridDimensions(facilityId, facility.level);
                    this.productGridSystem.updateGridDimensions(facilityId, gridWidth, gridHeight);

                    // Refresh the grid UI if currently viewing this facility
                    const navigationManager = this.navigationManager;
                    if (navigationManager && navigationManager.currentFacility === facilityId) {
                        const facilityView = document.querySelector(`.facility-view[data-view="${facilityId}"]`);
                        if (facilityView && this.navigationManager.uiBuilder && this.navigationManager.uiBuilder.productGridUI) {
                            // Refresh grid display without re-initializing (preserves placements)
                            this.navigationManager.uiBuilder.productGridUI.refreshGridDisplay(facilityId);
                        }
                    }
                } else if (facilityId === 'lodge') {
                    // Update worker capacity for lodge upgrades (refreshes arrivalInterval from upgrade data)
                    this.workerSystem.updateWorkerCapacity();
                } else if (facilityId === 'trading') {
                    // Update trading post capacity for trading post upgrades (refreshes arrivalInterval from upgrade data)
                    this.tradingPostSystem.updateTradingPostCapacity();
                }
            }

            this.uiUpdater.updateUI();
        }
    }

    upgradeStash() {
        if (this.stashManager.upgradeStash()) {
            this.uiUpdater.updateUI();
        }
    }

    /**
     * Show upgrade confirmation modal
     */
    showUpgradeConfirmation(facilityId) {
        // Store the facility ID for the confirmation
        this.pendingUpgradeFacilityId = facilityId;

        // Get facility data
        const facility = this.gameState.facilities[facilityId];
        const facilityData = dataLoader.getFacility(facilityId);
        if (!facility || !facilityData) return;

        // Get upgrade cost details
        const costDetails = this.upgradeSystem.getUpgradeCostDetails(facilityId);
        if (!costDetails) {
            alert('Cannot upgrade this facility further!');
            return;
        }

        // Build modal content
        const modal = document.getElementById('upgradeConfirmModal');
        if (!modal) return;

        const facilityName = facilityData.name || facilityId;

        // Update modal title and facility name
        document.getElementById('upgradeModalTitle').textContent = `Upgrade ${facilityName}`;
        document.getElementById('upgradeModalFacilityName').textContent = facilityName;

        // Update level info
        document.getElementById('upgradeCurrentLevel').textContent = `Level ${costDetails.currentLevel}`;
        document.getElementById('upgradeNextLevel').textContent = `Level ${costDetails.nextLevel}`;

        // Update statistics section
        const statisticsData = this.upgradeStatistics.getUpgradeStatistics(facilityId);
        const statisticsContainer = document.getElementById('upgradeModalStatistics');
        statisticsContainer.innerHTML = '';

        if (statisticsData && statisticsData.statistics.length > 0) {
            for (const stat of statisticsData.statistics) {
                const statItem = document.createElement('div');
                statItem.className = 'stat-item';

                if (stat.format === 'zones' && stat.changes) {
                    // Render zone changes
                    const changesHtml = stat.changes.map(change =>
                        `<div class="zone-change-item ${change.type}">${change.text}</div>`
                    ).join('');
                    statItem.innerHTML = `
                        <span class="stat-item-label">${stat.label}</span>
                        <div class="zone-changes">${changesHtml}</div>
                    `;
                } else if (stat.format === 'recipes' && stat.changes) {
                    // Render recipe changes
                    const changesHtml = stat.changes.map(change =>
                        `<div class="recipe-change-item ${change.type}">${change.text}</div>`
                    ).join('');
                    statItem.innerHTML = `
                        <span class="stat-item-label">${stat.label}</span>
                        <div class="recipe-changes">${changesHtml}</div>
                    `;
                } else {
                    // Render simple before/after comparison
                    statItem.innerHTML = `
                        <span class="stat-item-label">${stat.label}</span>
                        <div class="stat-item-values">
                            <span class="stat-before">${stat.before}</span>
                            <span class="stat-arrow">→</span>
                            <span class="stat-after">${stat.after}</span>
                        </div>
                    `;
                }

                statisticsContainer.appendChild(statItem);
            }
        }

        // Update costs list using grid layout
        const costsList = document.getElementById('upgradeModalCosts');
        costsList.innerHTML = '';

        // Use grid layout for required materials
        const costGridContainer = this.uiBuilder.renderCostItemsGridContainer(costDetails.costs);
        costsList.appendChild(costGridContainer);

        // Render facility conditions (if any)
        if (costDetails.conditions && costDetails.conditions.length > 0) {
            for (const condition of costDetails.conditions) {
                const conditionItem = document.createElement('div');
                conditionItem.className = `cost-item ${condition.isSatisfied ? 'sufficient' : 'insufficient'}`;

                conditionItem.innerHTML = `
                    <span class="cost-item-name">${condition.facilityName} Level</span>
                    <span>
                        <span class="cost-item-required">${condition.requiredLevel}</span>
                        <span style="color: #999;">/ Current:</span>
                        <span class="cost-item-current">${condition.currentLevel}</span>
                    </span>
                `;
                costsList.appendChild(conditionItem);
            }
        }

        // Update confirm button state
        const canUpgrade = this.upgradeSystem.canUpgrade(facilityId).canUpgrade;
        const confirmBtn = document.getElementById('confirmUpgradeBtn');

        if (canUpgrade) {
            confirmBtn.classList.remove('insufficient-resources');
            confirmBtn.style.backgroundColor = '#2ecc71'; // Green
        } else {
            confirmBtn.classList.add('insufficient-resources');
            confirmBtn.style.backgroundColor = '#95a5a6'; // Gray
        }

        // Show modal
        modal.classList.remove('hidden');
    }

    /**
     * Close upgrade confirmation modal
     */
    closeUpgradeConfirmation() {
        const modal = document.getElementById('upgradeConfirmModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.pendingUpgradeFacilityId = null;
    }

    /**
     * Handle modal background click (close modal)
     */
    handleModalBackgroundClick(e) {
        // Only close if clicking the modal background, not the content
        if (e.target.id === 'upgradeConfirmModal') {
            this.closeUpgradeConfirmation();
        } else if (e.target.id === 'resetConfirmModal') {
            this.closeResetConfirmation();
        } else if (e.target.id === 'fireConfirmModal') {
            this.closeFireConfirmation();
        } else if (e.target.id === 'workerSpawnRateModal') {
            this.closeWorkerSpawnRateInfo();
        } else if (e.target.id === 'workerDetailsModal') {
            this.closeWorkerDetailsModal();
        } else if (e.target.id === 'item-info-modal') {
            this.closeItemInfoModal();
        } else if (e.target.id === 'constructionConfirmModal') {
            this.closeConstructionConfirmation();
        }
    }

    /**
     * Confirm and execute upgrade
     */
    confirmUpgrade() {
        if (!this.pendingUpgradeFacilityId) return;

        const facilityId = this.pendingUpgradeFacilityId;

        // Close modal
        this.closeUpgradeConfirmation();

        // Execute upgrade
        let upgradeSucceeded = false;
        if (facilityId === 'trading') {
            upgradeSucceeded = this.upgradeTradingPost();
        } else if (facilityId === 'stash') {
            // Stash has special upgrade logic that updates capacity from storageSlots
            upgradeSucceeded = this.stashManager.upgradeStash();
        } else {
            upgradeSucceeded = this.upgradeSystem.upgradeFacility(facilityId);
        }

        if (upgradeSucceeded) {
            const facility = this.gameState.facilities[facilityId];
            const facilityName = this.getFacilityDisplayName(facilityId);

            // Log upgrade completion with grouped details
            console.groupCollapsed(`✅ Upgrade Complete: ${facilityName}`);
            console.log(`Facility: ${facilityName}`);
            console.log(`New Level: ${facility.level}`);
            if (facilityId === 'stash') {
                console.log(`Stash Capacity: ${this.gameState.stash.capacity} slots`);
            }
            console.groupEnd();

            // Update grid dimensions if this is a product facility
            if (facility) {
                const facilityData = dataLoader.getFacility(facilityId);
                if (facilityData && facilityData.type === 'product') {
                    const { x: gridWidth, y: gridHeight } = dataLoader.getGridDimensions(facilityId, facility.level);
                    this.productGridSystem.updateGridDimensions(facilityId, gridWidth, gridHeight);

                    // Refresh the grid UI if currently viewing this facility
                    const navigationManager = this.navigationManager;
                    if (navigationManager && navigationManager.currentFacility === facilityId) {
                        const facilityView = document.querySelector(`.facility-view[data-view="${facilityId}"]`);
                        if (facilityView && this.navigationManager.uiBuilder && this.navigationManager.uiBuilder.productGridUI) {
                            // Refresh grid display without re-initializing (preserves placements)
                            this.navigationManager.uiBuilder.productGridUI.refreshGridDisplay(facilityId);
                        }
                    }
                } else if (facilityId === 'lodge') {
                    // Update worker capacity for lodge upgrades
                    this.workerSystem.updateWorkerCapacity();
                }
            }

            // Explicitly refresh craftable items list if Processing Plant was upgraded
            // to immediately show newly unlocked recipes without requiring a manual filter toggle
            if (facilityId === 'processing') {
                this.uiBuilder.buildRecipesUI();
            }

            this.uiUpdater.updateUI();
        } else {
            alert('Upgrade failed! Check your resources.');
        }
    }

    /**
     * Get facility display name for logging
     */
    getFacilityDisplayName(facilityId) {
        const names = {
            'stash': 'Stash',
            'lodge': "Worker's Lodge",
            'farm': 'Farm',
            'mine': 'Mine',
            'ranch': 'Ranch',
            'fishery': 'Fishery',
            'processing': 'Processing Plant',
            'trading': 'Trading Post'
        };
        return names[facilityId] || facilityId;
    }

    sortStash() {
        this.stashManager.sortStash();
        this.uiUpdater.updateUI();
    }

    collectFromFacility(facilityId) {
        const result = this.productionSystem.collectFromFacility(facilityId, this.stashManager);

        // Show appropriate message based on collection result
        if (result.success) {
            // At least some items were collected
            if (result.partialCollection && result.itemsNotCollected.length > 0) {
                // Some items couldn't be collected due to stash being full
                alert(`Stash is full! Could not collect:\n${result.itemsNotCollected.join(', ')}`);
            }
            // Update UI regardless of partial or full collection
            this.uiUpdater.updateUI();
        } else if (result.partialCollection && result.itemsNotCollected.length > 0) {
            // No items were collected (stash already full on first attempt)
            alert(`Stash is full! Could not collect:\n${result.itemsNotCollected.join(', ')}`);
            this.uiUpdater.updateUI();
        } else {
            // Facility storage is empty
            alert('No items to collect.');
        }
    }

    toggleZoneEditMode(facilityId) {
        this.gameState.zoneEditMode[facilityId] = !this.gameState.zoneEditMode[facilityId];

        // Refresh the grid UI to show/hide the areas sidebar
        if (this.navigationManager && this.navigationManager.uiBuilder &&
            this.navigationManager.uiBuilder.productGridUI) {
            this.navigationManager.uiBuilder.productGridUI.refreshGridDisplay(facilityId);
        }
    }

    setGameSpeed(speed) {
        this.gameState.setGameSpeed(speed);

        // Update active button (for legacy controls)
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const legacyBtn = document.querySelector(`[data-speed="${speed}"]`);
        if (legacyBtn) legacyBtn.classList.add('active');

        // Update display
        const currentSpeedDisplay = document.getElementById('currentSpeed');
        if (currentSpeedDisplay) {
            currentSpeedDisplay.textContent = `${speed}x`;
        }
    }

    /**
     * Decrease game speed (0.5x multiplier, minimum 1x)
     */
    decreaseGameSpeed() {
        const currentSpeed = this.gameState.gameSpeed;
        let newSpeed = Math.max(1, currentSpeed / 2);

        // Ensure valid speed values
        const validSpeeds = [1, 2, 4, 8, 16, 32, 64];
        const currentIndex = validSpeeds.indexOf(currentSpeed);
        if (currentIndex > 0) {
            newSpeed = validSpeeds[currentIndex - 1];
        }

        this.setGameSpeed(newSpeed);
    }

    /**
     * Increase game speed (2x multiplier, maximum 64x)
     */
    increaseGameSpeed() {
        const currentSpeed = this.gameState.gameSpeed;
        let newSpeed = Math.min(64, currentSpeed * 2);

        // Ensure valid speed values
        const validSpeeds = [1, 2, 4, 8, 16, 32, 64];
        const currentIndex = validSpeeds.indexOf(currentSpeed);
        if (currentIndex < validSpeeds.length - 1) {
            newSpeed = validSpeeds[currentIndex + 1];
        }

        this.setGameSpeed(newSpeed);
    }

    saveGame() {
        this.gameState.saveGame();
    }

    /**
     * Show reset game confirmation modal
     */
    showResetConfirmation() {
        const modal = document.getElementById('resetConfirmModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Close reset game confirmation modal
     */
    closeResetConfirmation() {
        const modal = document.getElementById('resetConfirmModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Confirm and execute game reset
     */
    confirmReset() {
        // Close the confirmation modal
        this.closeResetConfirmation();

        // Clear the saved game data
        localStorage.removeItem('estateSimulatorSave');

        // Reload the page to start fresh
        location.reload();
    }

    /**
     * Show fire worker confirmation modal
     */
    showFireConfirmation(workerId) {
        // Find the worker to get their name
        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
        if (!worker) return;

        // Store the worker ID for the confirmation
        this.pendingFireWorkerId = workerId;

        // Update modal with worker name
        document.getElementById('fireWorkerName').textContent = worker.name;

        // Show modal
        const modal = document.getElementById('fireConfirmModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Close fire confirmation modal
     */
    closeFireConfirmation() {
        const modal = document.getElementById('fireConfirmModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.pendingFireWorkerId = null;
    }

    /**
     * Confirm and execute fire worker
     */
    confirmFireWorker() {
        if (!this.pendingFireWorkerId) return;

        const workerId = this.pendingFireWorkerId;

        // Close modal
        this.closeFireConfirmation();

        // Execute fire
        if (this.workerSystem.fireWorker(workerId)) {
            this.uiUpdater.updateUI();
        } else {
            alert('Failed to fire worker!');
        }
    }

    /**
     * Drag and drop handlers for stash
     */

    handleDragStart(e) {
        const element = e.target.closest('.stash-slot');
        if (!element) return;

        const slotIndex = parseInt(element.getAttribute('data-slot-index'));
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', slotIndex);
        element.classList.add('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const element = e.target.closest('.stash-slot');
        if (element) {
            element.classList.add('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const element = e.target.closest('.stash-slot');
        if (element) {
            element.classList.remove('drag-over');
        }

        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toElement = e.target.closest('.stash-slot');
        if (!toElement) return;

        const toIndex = parseInt(toElement.getAttribute('data-slot-index'));

        if (fromIndex !== toIndex) {
            this.stashManager.swapSlots(fromIndex, toIndex);
            this.uiUpdater.updateUI();
        }
    }

    handleDragEnd(e) {
        const element = e.target.closest('.stash-slot');
        if (element) {
            element.classList.remove('dragging');
        }
        document.querySelectorAll('.stash-slot').forEach(slot => {
            slot.classList.remove('drag-over');
        });
    }

    /**
     * Switch between lodge view sections
     */
    setLodgeView(viewType) {
        // Hide all views
        document.querySelectorAll('.lodge-view').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        const selectedView = document.querySelector(`.lodge-view[data-lodge-view="${viewType}"]`);
        if (selectedView) {
            selectedView.classList.add('active');
        }

        // Update navigation buttons
        document.querySelectorAll('.lodge-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.lodge-nav-btn[data-view-type="${viewType}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    /**
     * Switch between Trading Post views (Active Orders or Region Info)
     */
    setTradingView(viewType) {
        // Hide all views
        document.querySelectorAll('.trading-view').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        const selectedView = document.querySelector(`.trading-view[data-trading-view="${viewType}"]`);
        if (selectedView) {
            selectedView.classList.add('active');

            // Build Region Info UI if switching to region-info view
            if (viewType === 'region-info') {
                this.uiBuilder.buildRegionInfoUI();
            }
        }

        // Update navigation buttons
        document.querySelectorAll('.trading-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.trading-nav-btn[data-view-type="${viewType}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    /**
     * Show worker spawn rate info modal
     */
    showWorkerSpawnRateInfo() {
        const modal = document.getElementById('workerSpawnRateModal');
        if (!modal) return;

        // Get worker upgrade data for all levels
        const spawnRateContainer = document.getElementById('spawnRateTableContainer');
        if (!spawnRateContainer) return;

        // Build the table
        let tableHTML = '<table class="spawn-rate-table"><thead><tr><th>Facility Level</th>';

        // Get all unique grades and sort them
        const allGrades = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

        // Add grade headers
        allGrades.forEach(grade => {
            const gradeData = dataLoader.getWorkerGrade(grade);
            const gradeName = gradeData ? gradeData.name : grade;
            tableHTML += `<th>${gradeName}</th>`;
        });

        tableHTML += '</tr></thead><tbody>';

        // Add rows for each facility level
        for (let level = 1; level <= 5; level++) {
            const upgradeData = dataLoader.getWorkerUpgrade(level);
            if (!upgradeData) continue;

            tableHTML += `<tr><td class="level-cell">Level ${level}</td>`;

            // Parse gradeWeight to get weights for each grade
            let gradeWeights = {};
            try {
                if (typeof upgradeData.gradeWeight === 'string') {
                    gradeWeights = JSON.parse(upgradeData.gradeWeight);
                } else if (Array.isArray(upgradeData.gradeWeight)) {
                    gradeWeights = upgradeData.gradeWeight;
                }
            } catch (e) {
                console.error(`Failed to parse gradeWeight for level ${level}:`, e);
            }

            // Convert array to object if needed
            let gradeWeightMap = {};
            if (Array.isArray(gradeWeights)) {
                gradeWeights.forEach(item => {
                    gradeWeightMap[item.grade] = item.weight;
                });
            } else {
                gradeWeightMap = gradeWeights;
            }

            // Calculate total weight
            const totalWeight = Object.values(gradeWeightMap).reduce((sum, w) => sum + (w || 0), 0);

            // Add cells for each grade
            allGrades.forEach(grade => {
                const weight = gradeWeightMap[grade] || 0;
                const percentage = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : 0;
                const displayValue = weight === 0 ? '-' : `${percentage}%`;
                tableHTML += `<td class="grade-cell">${displayValue}</td>`;
            });

            tableHTML += '</tr>';
        }

        tableHTML += '</tbody></table>';
        spawnRateContainer.innerHTML = tableHTML;

        // Show modal
        modal.classList.remove('hidden');
    }

    /**
     * Close worker spawn rate info modal
     */
    closeWorkerSpawnRateInfo() {
        const modal = document.getElementById('workerSpawnRateModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Show worker details in a modal
     */
    showWorkerDetailsModal(workerId) {
        const worker = this.gameState.workers[workerId];
        if (!worker) return;

        const modal = document.getElementById('workerDetailsModal');
        if (!modal) return;

        // Update modal title
        document.getElementById('worker-details-title').textContent = worker.name;

        // Build worker card using existing buildHiredWorkerCard function
        const workerCardHtml = this.uiBuilder.buildHiredWorkerCard(worker);
        const modalBody = document.querySelector('.worker-details-modal-body');
        if (modalBody) {
            modalBody.innerHTML = workerCardHtml;
        }

        // Show modal
        modal.classList.remove('hidden');
    }

    /**
     * Close worker details modal
     */
    closeWorkerDetailsModal() {
        const modal = document.getElementById('workerDetailsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Show crafting details for a selected item
     */
    showCraftingDetails(itemId) {
        this.currentCraftingItem = itemId;
        this.currentCraftingQuantity = 1;
        this.uiBuilder.buildCraftingDetailsPanel(itemId);
    }

    /**
     * Decrease crafting quantity (minimum: 1)
     */
    decreaseCraftQuantity(itemId) {
        if (this.currentCraftingQuantity > 1) {
            this.currentCraftingQuantity--;
            const display = document.getElementById(`craft-quantity-${itemId}`);
            if (display) display.textContent = this.currentCraftingQuantity;
        }
    }

    /**
     * Increase crafting quantity (cap: max craftable)
     */
    increaseCraftQuantity(itemId, maxAmount) {
        if (maxAmount > 0 && this.currentCraftingQuantity < maxAmount) {
            this.currentCraftingQuantity++;
            const display = document.getElementById(`craft-quantity-${itemId}`);
            if (display) display.textContent = this.currentCraftingQuantity;
        }
    }

    /**
     * Decrease crafting quantity by bulk amount (minimum: 1)
     */
    decreaseCraftQuantityBulk(itemId, amount, maxAmount) {
        this.currentCraftingQuantity = Math.max(1, this.currentCraftingQuantity - amount);
        const display = document.getElementById(`craft-quantity-${itemId}`);
        if (display) display.textContent = this.currentCraftingQuantity;
    }

    /**
     * Increase crafting quantity by bulk amount (cap: max craftable, minimum: 1)
     */
    increaseCraftQuantityBulk(itemId, amount, maxAmount) {
        // If maxAmount is 0, keep quantity at 1; otherwise clamp between 1 and maxAmount
        if (maxAmount > 0) {
            this.currentCraftingQuantity = Math.min(maxAmount, this.currentCraftingQuantity + amount);
        } else {
            this.currentCraftingQuantity = 1;
        }
        const display = document.getElementById(`craft-quantity-${itemId}`);
        if (display) display.textContent = this.currentCraftingQuantity;
    }

    /**
     * Craft item with current quantity
     */
    craftWithQuantity(itemId) {
        const actualCrafted = this.craftingSystem.craft(itemId, this.currentCraftingQuantity);

        if (actualCrafted > 0) {
            // Refresh the UI
            this.uiBuilder.buildRecipesUI();
            this.showCraftingDetails(itemId);
            this.requestUIUpdate();
        }
    }

    /**
     * Filter craftable items by category
     */
    filterCraftableItems(filter) {
        this.uiBuilder.currentFilter = filter;

        // Update filter button states (only in Processing Plant filter sidebar)
        document.querySelectorAll('.processing-filter-sidebar .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.processing-filter-sidebar [data-filter="${filter}"]`)?.classList.add('active');

        // Rebuild the recipes UI with the new filter
        this.uiBuilder.buildRecipesUI();
    }

    /**
     * Filter stash items by category
     */
    filterStashItems(filter) {
        this.uiBuilder.currentStashFilter = filter;

        // Update filter button states (only in Stash filter sidebar)
        document.querySelectorAll('.stash-filter-sidebar .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.stash-filter-sidebar [data-filter="${filter}"]`)?.classList.add('active');

        // Reset stash hash to force rebuild on next update (ensures no flicker even with filter change)
        this.uiUpdater.resetStashHash();

        // Rebuild the stash UI with the new filter
        this.uiBuilder.buildStashUI();
    }

    /**
     * Set the sort mode for craftable items
     */
    setSortMode(sortMode) {
        this.uiBuilder.currentSort = sortMode;
        this.uiBuilder.buildRecipesUI();
    }

    /**
     * Set the sort mode for stash items
     */
    setStashSortMode(sortMode) {
        this.uiBuilder.currentStashSort = sortMode;
        this.uiBuilder.buildStashUI();
    }

    /**
     * Fulfill an order from the Trading Post
     */
    fulfillOrder(activeOrderId) {
        const success = this.tradingPostSystem.fulfillOrder(activeOrderId);
        if (success) {
            this.uiBuilder.buildTradingPostUI();
            this.requestUIUpdate();
        }
    }

    /**
     * Show reject order confirmation modal
     */
    showRejectOrderModal(activeOrderId) {
        this.pendingRejectOrderId = activeOrderId;

        const activeOrder = this.gameState.tradingPost.activeOrders.find(o => o.id === activeOrderId);
        if (!activeOrder) return;

        const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
        const region = dataLoader.getTradingRegion(activeOrder.regionId);
        const regionState = this.gameState.tradingRegions[activeOrder.regionId];

        if (!orderData || !region || !regionState) return;

        const penalty = Math.floor(orderData.credit * 0.5);

        const modalBody = document.getElementById('reject-order-modal-body');
        modalBody.innerHTML = `
            <p class="reject-modal-warning"><strong>Are you sure?</strong><br>Rejecting will decrease Trust with <strong>${region.name}</strong> by <strong>${penalty}</strong>.</p>

            <div class="reject-modal-region-info">
                <h4>${region.name}</h4>
                <div class="order-region-credit-bar">
                    <div class="credit-bar-fill" style="width: ${(regionState.exp / regionState.nextLevelExp) * 100}%"></div>
                    <div class="credit-bar-text-overlay">
                        <span class="credit-bar-level">Level ${regionState.level}</span>
                        <span class="credit-bar-xp">${regionState.exp} (-${penalty}) / ${regionState.nextLevelExp}</span>
                    </div>
                </div>
            </div>
        `;

        const modal = document.getElementById('reject-order-modal');
        modal.classList.remove('hidden');
    }

    /**
     * Close reject order modal
     */
    closeRejectOrderModal() {
        const modal = document.getElementById('reject-order-modal');
        modal.classList.add('hidden');
        this.pendingRejectOrderId = null;
    }

    /**
     * Confirm reject order
     */
    confirmRejectOrder() {
        if (!this.pendingRejectOrderId) return;

        this.tradingPostSystem.rejectOrder(this.pendingRejectOrderId);
        this.closeRejectOrderModal();
        this.uiBuilder.buildTradingPostUI();
        this.requestUIUpdate();
    }

    /**
     * Show trade confirmation modal
     */
    showTradeConfirmationModal(activeOrderId) {
        this.pendingTradeOrderId = activeOrderId;

        const activeOrder = this.gameState.tradingPost.activeOrders.find(o => o.id === activeOrderId);
        if (!activeOrder) return;

        const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
        const region = dataLoader.getTradingRegion(activeOrder.regionId);
        const regionState = this.gameState.tradingRegions[activeOrder.regionId];

        // DEFENSIVE: Ensure all required data exists
        if (!orderData || !region || !regionState) return;

        const modalBody = document.getElementById('trade-confirmation-modal-body');
        if (!modalBody) return;

        modalBody.innerHTML = '';

        // Create the order card display (same as Active Orders grid)
        const card = document.createElement('div');
        card.className = 'trading-order-card';

        // Header: Region info with Grade badge
        const header = document.createElement('div');
        header.className = 'order-card-header';

        const gradeBadge = document.createElement('div');
        gradeBadge.className = `order-grade grade-${orderData.grade.toLowerCase()}`;
        gradeBadge.textContent = orderData.grade;

        const regionInfoDiv = document.createElement('div');
        regionInfoDiv.className = 'order-region-info';
        regionInfoDiv.innerHTML = `<h4>${region.name}</h4>`;

        // PROJECTION: Calculate the projected region state after trade
        const projectedExpAfterTrade = regionState.exp + orderData.credit;
        let levelUpCount = 0;
        let tempExp = projectedExpAfterTrade;
        let tempLevel = regionState.level;
        let tempNextLevelExp = regionState.nextLevelExp;
        const maxLevel = dataLoader.getTradingRegionMaxLevel(activeOrder.regionId);

        // Simulate level-ups if applicable
        while (tempExp >= tempNextLevelExp && tempLevel < maxLevel) {
            tempExp -= tempNextLevelExp;
            tempLevel++;
            tempNextLevelExp = dataLoader.getRegionLevelExp(activeOrder.regionId, tempLevel);
            levelUpCount++;
        }

        // Progress bar always uses current level's scale
        // If leveling up, projected exp is capped at current level's max
        const projectedExpInCurrentLevel = Math.min(projectedExpAfterTrade, regionState.nextLevelExp);

        // Build credit bar with two-color fills: base (current) + projected gain
        const creditBarDiv = document.createElement('div');
        creditBarDiv.className = 'order-region-credit-bar trade-confirmation-credit-bar';

        // Calculate fill percentages (always using current level's scale)
        const currentFillPercent = (regionState.exp / regionState.nextLevelExp) * 100;
        const projectedFillPercent = (projectedExpInCurrentLevel / regionState.nextLevelExp) * 100;

        // If leveling up, projected bar shows as 100% to indicate level completion
        const projectedBarWidth = levelUpCount > 0 ? 100 : Math.max(0, projectedFillPercent - currentFillPercent);

        creditBarDiv.innerHTML = `
            <div class="credit-bar-fill credit-bar-fill-projected" style="width: ${projectedBarWidth}%"></div>
            <div class="credit-bar-fill credit-bar-fill-current" style="width: ${Math.min(currentFillPercent, 100)}%"></div>
            <div class="credit-bar-text-overlay trade-confirmation-credit-text">
                <span class="credit-bar-level">Level ${tempLevel}${levelUpCount > 0 ? ` <span class="level-up-indicator">(+${levelUpCount})</span>` : ''}</span>
                <span class="credit-bar-xp">${tempExp} <span class="credit-gain">(+${orderData.credit})</span> / ${levelUpCount > 0 ? tempNextLevelExp : regionState.nextLevelExp}</span>
            </div>
        `;

        header.appendChild(gradeBadge);
        header.appendChild(regionInfoDiv);
        header.appendChild(creditBarDiv);

        // Body: Order details (required and reward items)
        const body = document.createElement('div');
        body.className = 'order-card-body';

        // Required items
        const requiredSection = document.createElement('div');
        requiredSection.className = 'order-required';
        requiredSection.innerHTML = '<h5>Required:</h5>';

        const requiredItemsContainer = document.createElement('div');
        requiredItemsContainer.className = 'order-required-items';

        const requiredArray = this.uiBuilder.unwrapArray(orderData.required);
        for (const req of requiredArray) {
            const item = dataLoader.getItem(req.itemId);
            if (!item) continue;

            const have = this.stashManager.getItemQuantity(req.itemId);
            const isSufficient = have >= req.count;
            const itemGrade = item.grade || 'common';
            const firstLetter = item.name.charAt(0).toUpperCase();

            const itemCard = document.createElement('div');
            itemCard.className = `order-required-item grade-${itemGrade}`;
            itemCard.innerHTML = `
                <div class="required-item-icon">${firstLetter}</div>
                <div class="required-item-name">${item.name}</div>
                <div class="required-item-qty ${isSufficient ? 'available' : 'unavailable'}">${req.count} (${have})</div>
            `;
            requiredItemsContainer.appendChild(itemCard);
        }
        requiredSection.appendChild(requiredItemsContainer);
        body.appendChild(requiredSection);

        // Reward items
        const rewardSection = document.createElement('div');
        rewardSection.className = 'order-reward';
        rewardSection.innerHTML = '<h5>Reward:</h5>';

        const rewardItemsContainer = document.createElement('div');
        rewardItemsContainer.className = 'order-reward-items';

        const rewardArray = this.uiBuilder.unwrapArray(orderData.reward);
        for (const reward of rewardArray) {
            let itemName = '';
            let itemGrade = 'common';
            let firstLetter = '?';

            if (reward.itemId === 'gold') {
                itemName = 'Gold';
                firstLetter = 'G';
            } else {
                const item = dataLoader.getItem(reward.itemId);
                if (item) {
                    itemName = item.name;
                    itemGrade = item.grade || 'common';
                    firstLetter = item.name.charAt(0).toUpperCase();
                } else {
                    itemName = reward.itemId;
                    firstLetter = reward.itemId.charAt(0).toUpperCase();
                }
            }

            const itemCard = document.createElement('div');
            itemCard.className = `order-reward-item grade-${itemGrade}`;
            itemCard.innerHTML = `
                <div class="reward-item-icon">${firstLetter}</div>
                <div class="reward-item-name">${itemName}</div>
                <div class="reward-item-qty">×${reward.count}</div>
            `;
            rewardItemsContainer.appendChild(itemCard);
        }
        rewardSection.appendChild(rewardItemsContainer);
        body.appendChild(rewardSection);

        card.appendChild(header);
        card.appendChild(body);
        modalBody.appendChild(card);

        const modal = document.getElementById('trade-confirmation-modal');
        modal.classList.remove('hidden');
    }

    /**
     * Close trade confirmation modal
     */
    closeTradeConfirmationModal() {
        const modal = document.getElementById('trade-confirmation-modal');
        modal.classList.add('hidden');
        this.pendingTradeOrderId = null;
    }

    /**
     * Confirm trade order
     */
    confirmTradeOrder() {
        if (!this.pendingTradeOrderId) return;

        this.fulfillOrder(this.pendingTradeOrderId);
        this.closeTradeConfirmationModal();
    }

    /**
     * Show Item Info Modal
     * @param {Array} items - Array of item objects with itemId, itemName, quantity
     * @param {number} selectedIndex - Index of the item to display initially
     */
    showItemInfoModal(items, selectedIndex = 0) {
        const modal = document.getElementById('item-info-modal');
        if (!modal) return;

        const listPanel = document.getElementById('item-info-list-panel');
        const detailsPanel = document.getElementById('item-info-details-panel');

        if (items.length === 0) return;

        // Single item case - hide list panel
        if (items.length === 1) {
            listPanel.style.display = 'none';
            this.renderItemDetails(items[0], detailsPanel);
        } else {
            // Multiple items - show list panel
            listPanel.style.display = 'block';
            this.renderItemList(items, selectedIndex, detailsPanel);
        }

        // Show modal
        modal.classList.remove('hidden');
    }

    /**
     * Close Item Info Modal
     */
    closeItemInfoModal() {
        const modal = document.getElementById('item-info-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Render item list in the left panel
     */
    renderItemList(items, selectedIndex, detailsPanel) {
        const listContainer = document.getElementById('item-info-list');
        listContainer.innerHTML = '';

        items.forEach((item, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'item-info-list-item';
            if (index === selectedIndex) {
                listItem.classList.add('selected');
            }

            listItem.innerHTML = `
                <div class="item-info-list-icon">${item.itemId.charAt(0).toUpperCase()}</div>
                <div class="item-info-list-text">
                    <div class="item-info-list-name">${item.itemName}</div>
                    <div class="item-info-list-type">${item.itemType || 'Item'}</div>
                </div>
            `;

            listItem.addEventListener('click', () => {
                document.querySelectorAll('.item-info-list-item').forEach(el => {
                    el.classList.remove('selected');
                });
                listItem.classList.add('selected');
                this.renderItemDetails(item, detailsPanel);
            });

            listContainer.appendChild(listItem);
        });

        // Render initial selected item
        this.renderItemDetails(items[selectedIndex], detailsPanel);
    }

    /**
     * Get grade hex color for display
     */
    getGradeHexColor(grade) {
        const gradeColors = {
            'common': '#95a5a6',
            'uncommon': '#2ecc71',
            'rare': '#3498db',
            'epic': '#9b59b6',
            'legendary': '#e74c3c'
        };
        return gradeColors[grade?.toLowerCase()] || '#95a5a6';
    }

    /**
     * Render item details in the right panel
     */
    renderItemDetails(item, detailsPanel) {
        const itemData = dataLoader.getItem(item.itemId);
        if (!itemData) return;

        const gradeColor = this.getGradeHexColor(itemData.grade);
        const maxStack = itemData.stacks || 1;
        const totalOwned = this.stashManager.getItemQuantity(item.itemId);

        // Parse recipe if it exists
        let recipeSectionHtml = '';
        if (itemData.recipe) {
            try {
                const recipe = typeof itemData.recipe === 'string' ? JSON.parse(itemData.recipe) : itemData.recipe;
                if (recipe.materials && recipe.materials.length > 0) {
                    const ingredientsHtml = recipe.materials.map(material => {
                        const ingredientData = dataLoader.getItem(material.itemId);
                        const ingredientName = ingredientData ? ingredientData.name : material.itemId;
                        const ingredientLetter = ingredientName.charAt(0).toUpperCase();
                        const owned = this.stashManager.getItemQuantity(material.itemId);
                        const isAvailable = owned >= material.count;
                        const availabilityClass = isAvailable ? 'available' : '';

                        return `
                            <div class="ingredient-item">
                                <div class="ingredient-icon">${ingredientLetter}</div>
                                <div class="ingredient-name">${ingredientName}</div>
                                <div class="ingredient-count ${availabilityClass}">${material.count} (${owned})</div>
                            </div>
                        `;
                    }).join('');

                    recipeSectionHtml = `
                        <div class="item-detail-recipe">
                            <h4>Recipe / Ingredients</h4>
                            <div class="ingredients-grid">
                                ${ingredientsHtml}
                            </div>
                        </div>
                    `;
                }
            } catch (e) {
                console.warn(`Failed to parse recipe for item ${item.itemId}:`, e);
            }
        }

        // Get processing level requirement if applicable
        let processingLevelHtml = '';
        const processingLevel = dataLoader.getItemProcessingLevel(item.itemId);
        if (processingLevel !== null) {
            processingLevelHtml = `
                <div class="item-detail-requirement">
                    <span class="requirement-label">Required Processing Plant Level:</span>
                    <span class="requirement-value">${processingLevel}</span>
                </div>
            `;
        }

        const gradeName = itemData.grade ? itemData.grade.charAt(0).toUpperCase() + itemData.grade.slice(1) : 'Common';

        detailsPanel.innerHTML = `
            <div class="item-detail-header">
                <div class="item-detail-icon">${item.itemId.charAt(0).toUpperCase()}</div>
                <div class="item-detail-info">
                    <div class="item-detail-header-top">
                        <div class="item-detail-name">${item.itemName}</div>
                        <div class="item-detail-grade" style="background-color: ${gradeColor};">${gradeName}</div>
                    </div>
                    <div class="item-detail-type">${itemData.type || 'Item'}</div>
                </div>
            </div>
            ${itemData.description ? `<div class="item-detail-description">${itemData.description}</div>` : ''}
            <div class="item-detail-stats">
                <div class="item-detail-stat">
                    <span class="item-detail-stat-label">Max Stack:</span>
                    <span class="item-detail-stat-value">${maxStack}</span>
                </div>
                <div class="item-detail-stat">
                    <span class="item-detail-stat-label">Total Owned:</span>
                    <span class="item-detail-stat-value">${totalOwned}</span>
                </div>
            </div>
            ${recipeSectionHtml}
            ${processingLevelHtml}
        `;
    }

    /**
     * Handle modal background click (close item info modal)
     */

    /**
     * Show Trading Post upgrade modal (uses standard upgrade logic)
     */
    showTradingUpgradeModal() {
        // Use the standard upgrade confirmation for Trading Post
        this.showUpgradeConfirmation('trading');
    }

    /**
     * Upgrade Trading Post (called from modal confirmation)
     * Uses standard upgrade system from facilityUpgrade.csv
     */
    upgradeTradingPost() {
        const facility = this.gameState.facilities['trading'];
        if (!facility) return false;

        const nextLevel = facility.level + 1;
        const upgradeCost = dataLoader.getUpgradeCost('trading', nextLevel);

        if (!upgradeCost) {
            alert('Cannot upgrade further!');
            return false;
        }

        let requirements = upgradeCost.requirements || [];

        // Handle requirements that might be wrapped in a {value: [...]} object
        if (requirements && typeof requirements === 'object' && !Array.isArray(requirements) && requirements.value) {
            requirements = requirements.value;
        }
        // Ensure requirements is an array
        if (!Array.isArray(requirements)) {
            requirements = [];
        }

        // Check all requirements
        for (const req of requirements) {
            const itemId = req.itemId;
            const required = req.count;
            const have = itemId === 'gold' ? this.gameState.gold : this.stashManager.getItemQuantity(itemId);

            if (have < required) {
                const item = dataLoader.getItem(itemId);
                const itemName = item ? item.name : itemId;
                alert(`Not enough ${itemName}! Need ${required}, have ${have}`);
                return false;
            }
        }

        // Consume all requirements
        for (const req of requirements) {
            const itemId = req.itemId;
            const count = req.count;

            if (itemId === 'gold') {
                this.gameState.gold -= count;
            } else {
                this.stashManager.removeItemFromStash(itemId, count);
            }
        }

        // Upgrade facility level
        facility.level = nextLevel;

        // Update Trading Post-specific properties from the old tradingUpgrades data
        // (for backwards compatibility until tradingUpgrades is fully deprecated)
        const legacyUpgradeData = dataLoader.getTradingUpgrade(nextLevel);
        if (legacyUpgradeData) {
            this.gameState.tradingPost.arrivalInterval = legacyUpgradeData.cooltime * 1000;
            this.gameState.tradingPost.maxQueueSlots = legacyUpgradeData.maxQueueSlots;
        }
        this.gameState.tradingPost.level = nextLevel;

        this.closeUpgradeConfirmation();
        this.requestUIUpdate();
        return true;
    }

    /**
     * Request UI update on next frame
     */
    requestUIUpdate() {
        this.uiUpdater.updateUI();
    }

    /**
     * Show construction confirmation modal
     */
    showConstructionConfirmation(facilityId) {
        // Store the facility ID for the confirmation
        this.pendingConstructionFacilityId = facilityId;

        // Get facility data
        const facilityData = dataLoader.getFacility(facilityId);
        if (!facilityData) return;

        // Get construction cost details
        const costDetails = this.upgradeSystem.getConstructionCostDetails(facilityId);
        if (!costDetails) {
            alert('Cannot construct this facility!');
            return;
        }

        // Build modal content
        const modal = document.getElementById('constructionConfirmModal');
        if (!modal) return;

        // Update modal title to include facility name
        const modalTitle = modal.querySelector('.modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = `Construct Facility : ${costDetails.facilityName}`;
        }

        // Update costs section
        const costsContainer = document.getElementById('constructionModalCosts');
        costsContainer.innerHTML = '';

        let allRequirementsMet = true;

        // Render facility prerequisites first
        if (costDetails.conditions && costDetails.conditions.length > 0) {
            for (const condition of costDetails.conditions) {
                const conditionItem = document.createElement('div');
                conditionItem.className = `cost-item ${condition.isSatisfied ? 'sufficient' : 'insufficient'}`;
                conditionItem.innerHTML = `
                    <span class="cost-item-name">${condition.facilityName}</span>
                    <span>
                        Lv. ${condition.requiredLevel}
                        <span style="color: #999;">/ Have:</span>
                        Lv. ${condition.currentLevel}
                    </span>
                `;
                costsContainer.appendChild(conditionItem);
                if (!condition.isSatisfied) allRequirementsMet = false;
            }
        }

        // Render item costs
        for (const cost of costDetails.costs) {
            const costItem = document.createElement('div');
            costItem.className = `cost-item ${cost.isSufficient ? 'sufficient' : 'insufficient'}`;
            costItem.innerHTML = `
                <span class="cost-item-name">${cost.itemName}</span>
                <span>
                    <span class="cost-item-required">${cost.required}</span>
                    <span style="color: #999;">/ Have:</span>
                    <span class="cost-item-current">${cost.have}</span>
                </span>
            `;
            costsContainer.appendChild(costItem);
            if (!cost.isSufficient) allRequirementsMet = false;
        }

        // Update confirm button state
        const confirmBtn = document.getElementById('confirmConstructionBtn');
        if (confirmBtn) {
            confirmBtn.disabled = !allRequirementsMet;
            if (allRequirementsMet) {
                confirmBtn.classList.remove('insufficient-resources');
                confirmBtn.style.backgroundColor = '#2ecc71'; // Green
            } else {
                confirmBtn.classList.add('insufficient-resources');
                confirmBtn.style.backgroundColor = '#95a5a6'; // Gray
            }
        }

        // Show modal
        modal.classList.remove('hidden');
    }

    /**
     * Close construction confirmation modal
     */
    closeConstructionConfirmation() {
        const modal = document.getElementById('constructionConfirmModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.pendingConstructionFacilityId = null;
    }

    /**
     * Confirm and execute facility construction
     */
    confirmConstruction() {
        if (!this.pendingConstructionFacilityId) return;

        const facilityId = this.pendingConstructionFacilityId;

        // Close modal
        this.closeConstructionConfirmation();

        // Execute construction
        const constructionSucceeded = this.upgradeSystem.constructFacility(facilityId);

        if (constructionSucceeded) {
            const facilityName = this.getFacilityDisplayName(facilityId);
            const facility = this.gameState.facilities[facilityId];
            console.groupCollapsed(`✅ Construction Complete: ${facilityName}`);
            console.log(`Facility: ${facilityName}`);
            console.log(`Level: ${facility.level}`);
            if (facility.assignedWorkers !== undefined) {
                console.log(`Capacity: ${facility.assignedWorkers ? facility.assignedWorkers : 0} workers assigned`);
            }
            console.groupEnd();

            // Update system-specific capacities and timers after construction
            if (facilityId === 'lodge') {
                // Initialize worker arrival system for newly constructed lodge
                this.workerSystem.updateWorkerCapacity();
            } else if (facilityId === 'trading') {
                // Initialize trading post order system for newly constructed trading post
                this.tradingPostSystem.updateTradingPostCapacity();
            } else if (facilityId === 'processing') {
                // Initialize craftable items list for newly constructed Processing Plant
                // Ensures recipes UI is populated immediately without requiring manual filter toggle
                this.uiBuilder.buildRecipesUI();
            }

            // Refresh navigation to show newly built facility
            this.navigationManager.initializeNavigation();
            // Clear the indicator cache so status indicators render immediately on the newly created button
            this.uiUpdater.clearNavigationIndicatorCache();

            // Rebuild construction grid to reflect newly built facility (removed from available construction list)
            // Keep Construction View active so user can build more facilities
            const mainView = document.getElementById('main-view');
            if (mainView) {
                this.uiBuilder.buildConstructionGridUI(mainView);
            }

            this.uiUpdater.updateUI();
        } else {
            alert('Construction failed! Check your resources.');
        }
    }

    /**
     * Exit construction mode
     */
    exitConstructionMode() {
        this.navigationManager.exitConstructionMode();
    }

    /**
     * Update Add Facility button state (called from uiUpdater on resource changes)
     */
    updateAddFacilityButton() {
        this.navigationManager.updateAddFacilityButton();
    }
}

/**
 * Initialize game when DOM and data are ready
 */
let game;
document.addEventListener('DOMContentLoaded', async () => {
    game = new GameLoopManager();
    window.game = game; // Make globally accessible for onclick handlers
    await game.init();
});
