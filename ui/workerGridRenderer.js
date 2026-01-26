/**
 * Worker Grid Renderer
 * Handles rendering of worker grids, idle workers panel, and worker-related UI components
 */
class WorkerGridRenderer {
    constructor(gameState, gameLoopManager, workerGridSystem = null) {
        this.gameState = gameState;
        this.gameLoopManager = gameLoopManager;
        this.workerGridSystem = workerGridSystem;
        this.uiOrchestrator = null;
    }

    /**
     * Set the UI orchestrator reference for callback delegation
     */
    setUIOrchestrator(productGridUI) {
        this.uiOrchestrator = productGridUI;
    }

    /**
     * Create Worker Grid component for a production area
     * Three-section layout: header, worker grid, stat bonus display
     * Header: Single line with truncated area name and (Current/Max) count positioned at top-left
     * Worker grid: Only displays slots up to max worker capacity
     */
    createWorkerGrid(facilityId, zoneKey, area, placementIndex, isEditMode = false) {
        const container = document.createElement('div');
        container.className = 'worker-grid-wrapper';
        container.dataset.zoneKey = zoneKey;
        container.dataset.areaId = area.id; // Store areaId for reliable retrieval

        // ===== TOP SECTION: Area Name and Worker Count (Top-Left) =====
        const headerSection = document.createElement('div');
        headerSection.className = 'worker-grid-header';

        const workerCount = this.workerGridSystem?.getWorkersInZone(zoneKey).length || 0;
        const maxWorkers = area.workers || 0; // Max worker capacity

        // Create single line header with area name and worker count
        const headerText = document.createElement('span');
        headerText.className = 'worker-grid-header-text';

        // Build the display: "Area Name (Current/Max)" format
        const areaNamePart = document.createElement('span');
        areaNamePart.className = 'worker-grid-area-name';
        areaNamePart.textContent = area.id;

        const countPart = document.createElement('span');
        countPart.className = 'worker-grid-count';
        countPart.textContent = `(${workerCount}/${maxWorkers})`;
        countPart.dataset.zoneKey = zoneKey;

        headerText.appendChild(areaNamePart);
        headerText.appendChild(document.createTextNode(' '));
        headerText.appendChild(countPart);

        headerSection.appendChild(headerText);
        container.appendChild(headerSection);

        // ===== MIDDLE SECTION: Worker Grid =====
        // Worker grid dimensions based on area grid dimensions (X, Y)
        // Formula: Max grid capacity = (X, Y-1), minimum 1 for each dimension
        // Keep full horizontal width (X) to avoid side obstruction
        // Reduce vertical (Y-1) to avoid overlapping with top/bottom info
        // Total cells in worker grid = maxWorkers from CSV (area.workers)
        const areaGridX = area.gridX || 1;
        const areaGridY = area.gridY || 1;

        // Calculate max grid layout dimensions using (X, Y-1) formula
        const maxWorkerGridX = Math.max(1, areaGridX);
        const maxWorkerGridY = Math.max(1, areaGridY - 1);
        const maxGridCapacity = maxWorkerGridX * maxWorkerGridY;

        // Total cells to display = min(maxWorkers, maxGridCapacity)
        const totalWorkerGridCells = Math.min(maxWorkers, maxGridCapacity);

        // Calculate actual grid dimensions needed to fit totalWorkerGridCells
        // Background will only show cells for actual worker count, not the maximum
        // Keep width constrained to maxWorkerGridX, but only use necessary rows
        let workerGridX = Math.min(totalWorkerGridCells, maxWorkerGridX);
        let workerGridY = Math.ceil(totalWorkerGridCells / maxWorkerGridX);

        // Create worker slots container
        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'worker-slots-container';
        slotsContainer.style.gridTemplateColumns = `repeat(${workerGridX}, 1fr)`;
        slotsContainer.style.gridTemplateRows = `repeat(${workerGridY}, 1fr)`;

        const occupiedSlots = this.workerGridSystem?.getOccupiedSlots(zoneKey) || {};
        const totalAssignedWorkers = Object.keys(occupiedSlots).length;

        // Overflow only occurs if assigned workers exceed maxWorkers capacity
        const hasOverflow = totalAssignedWorkers > totalWorkerGridCells;
        const overflowCount = hasOverflow ? (totalAssignedWorkers - (totalWorkerGridCells - 1)) : 0;

        // Render slots up to maxWorkers capacity
        for (let i = 0; i < totalWorkerGridCells; i++) {
            const slot = document.createElement('div');
            slot.className = 'worker-slot worker-slot-scaled';
            slot.dataset.slotIndex = i;
            slot.dataset.zoneKey = zoneKey;

            // Add disabled class if in edit mode
            if (isEditMode) {
                slot.classList.add('disabled');
            }

            // Check if this is the overflow cell (last cell when overflow exists)
            const isOverflowCell = hasOverflow && (i === totalWorkerGridCells - 1);

            if (isOverflowCell) {
                // Last cell shows overflow count
                slot.innerHTML = `<span class="overflow-indicator">(+${overflowCount})</span>`;
                slot.classList.add('overflow-cell');
            } else if (occupiedSlots[i]) {
                // Regular slot with assigned worker - worker is in this specific slot
                const workerId = occupiedSlots[i];
                const worker = this.gameState.workers.hired.find(w => w.id === workerId);
                if (worker) {
                    this.updateWorkerSlot(slot, worker, isEditMode);
                }
            } else {
                // Empty slot
                slot.innerHTML = '<span class="empty-slot-icon">+</span>';
            }

            // Allow dragging assigned workers - only in normal mode and not for overflow cells
            if (!isOverflowCell && occupiedSlots[i] && !isEditMode) {
                const workerId = occupiedSlots[i];
                slot.draggable = true;

                // Store zoneKey and workerId as data attributes to avoid closure issues
                slot.dataset.workerZoneKey = zoneKey;
                slot.dataset.workerId = workerId;

                slot.addEventListener('dragstart', (e) => {
                    const storedZoneKey = e.currentTarget.dataset.workerZoneKey;
                    const storedWorkerId = e.currentTarget.dataset.workerId;
                    this.uiOrchestrator.handleWorkerDragStart(e, storedWorkerId, storedZoneKey);
                });
                slot.addEventListener('dragend', (e) => this.uiOrchestrator.handleWorkerDragEnd(e));
            }

            slotsContainer.appendChild(slot);
        }

        container.appendChild(slotsContainer);

        // NEW: Add drag-over handlers to the slots container (entire placed area drop target)
        // When dragging a worker over any part of the area, highlight it as a valid drop target
        if (!isEditMode) {
            slotsContainer.addEventListener('dragover', (e) => this.uiOrchestrator.handleWorkerAreaDragOver(e, slotsContainer));
            slotsContainer.addEventListener('dragleave', (e) => this.uiOrchestrator.handleWorkerAreaDragLeave(e, slotsContainer));
            slotsContainer.addEventListener('drop', (e) => this.uiOrchestrator.handleWorkerAreaDrop(e, zoneKey, facilityId));
        }

        // ===== BOTTOM SECTION: Stat Bonus Display =====
        const bonusDisplay = document.createElement('div');
        bonusDisplay.className = 'stat-bonus-display';
        bonusDisplay.dataset.zoneKey = zoneKey;
        bonusDisplay.style.display = 'none';
        container.appendChild(bonusDisplay);

        return container;
    }

    /**
     * Update a worker slot with worker data
     */
    updateWorkerSlot(slot, worker, isEditMode = false) {
        const gradeClass = worker.grade ? `grade-${worker.grade}` : 'grade-common';
        const workerInitial = worker.name.charAt(0).toUpperCase();
        slot.innerHTML = `
            <div class="worker-portrait ${gradeClass}">
                <span class="worker-initial">${workerInitial}</span>
                <span class="worker-level-badge">Lv${worker.level}</span>
            </div>
        `;
        // Only make draggable in normal mode
        if (!isEditMode) {
            slot.draggable = true;
        }
    }

    /**
     * Create idle workers panel
     */
    createIdleWorkersPanel(facilityId) {
        const panel = document.createElement('div');
        panel.className = 'idle-workers-panel';

        // Header with title - matching area sidebar structure
        const sidebarHeader = document.createElement('div');
        sidebarHeader.className = 'sidebar-header';

        const title = document.createElement('h3');
        title.textContent = 'Available Workers';
        sidebarHeader.appendChild(title);

        panel.appendChild(sidebarHeader);

        const list = document.createElement('div');
        list.className = 'idle-worker-list';

        const idleWorkers = this.gameLoopManager.workerSystem.getAvailableWorkers();

        if (idleWorkers.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = 'No workers available';
            list.appendChild(emptyMsg);
        } else {
            for (const worker of idleWorkers) {
                const card = document.createElement('div');
                card.className = 'idle-worker-card';
                card.draggable = true;
                card.dataset.workerId = worker.id;

                const gradeClass = `grade-${worker.grade}`;
                const workerInitial = worker.name.charAt(0).toUpperCase();

                // Calculate EXP display
                const isMaxLevel = dataLoader.isWorkerAtMaxLevel(worker);
                const currentExp = worker.exp || 0;
                const requiredExp = isMaxLevel ? 100 : dataLoader.getExpRequiredForLevel(worker.level + 1);
                const expPercentage = isMaxLevel ? 100 : Math.floor((currentExp / requiredExp) * 100);
                const expText = isMaxLevel ? 'Max Level' : `${currentExp} / ${requiredExp} EXP`;

                const expDisplay = `<div class="worker-exp-display${isMaxLevel ? ' max-level' : ''}">
                    <div class="exp-text">${expText}</div>
                    <div class="exp-bar">
                        <div class="exp-bar-fill" style="width: ${expPercentage}%"></div>
                    </div>
                </div>`;

                card.innerHTML = `
                    <div class="worker-portrait ${gradeClass}">
                        <span class="worker-initial">${workerInitial}</span>
                    </div>
                    <div class="worker-card-info">
                        <div class="worker-name">${worker.name}</div>
                        <div class="worker-grade">${worker.grade}</div>
                        ${expDisplay}
                    </div>
                `;

                card.addEventListener('dragstart', (e) => {
                    this.uiOrchestrator.draggedWorker = {
                        workerId: worker.id,
                        sourceType: 'idle',
                        sourceZone: null
                    };
                    e.dataTransfer.effectAllowed = 'move';
                    card.classList.add('dragging');
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                    this.uiOrchestrator.draggedWorker = null;
                });

                // Add click handler to show worker details modal
                card.addEventListener('click', (e) => {
                    // Prevent opening modal while dragging
                    if (!this.uiOrchestrator.draggedWorker) {
                        this.gameLoopManager.showWorkerDetailsModal(worker.id);
                    }
                });

                list.appendChild(card);
            }
        }

        panel.appendChild(list);
        return panel;
    }

    /**
     * Update stat bonus display for a zone
     */
    updateStatBonusDisplay(zoneKey) {
        const display = document.querySelector(`[data-zone-key="${zoneKey}"] .stat-bonus-display`);
        if (!display) return;

        // Find the area from the zone key
        const [facilityId, areaId] = zoneKey.split('_').slice(0, 2);
        const area = dataLoader.getProductArea(areaId);
        if (!area) return;

        const productionSystem = this.gameLoopManager.productionSystem;
        const statBonus = productionSystem.calculateStatBonus(zoneKey, area);
        const speedMultiplier = Math.pow(2, statBonus / 100);

        if (statBonus > 0) {
            const percentage = ((speedMultiplier - 1) * 100).toFixed(0);
            display.textContent = `+${percentage}% Speed`;
            display.style.display = 'block';
        } else {
            display.style.display = 'none';
        }
    }
}
