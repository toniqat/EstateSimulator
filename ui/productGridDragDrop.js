/**
 * Product Grid Drag-Drop Handler
 * Handles all drag-and-drop interactions for grid placement and worker assignment
 */
class ProductGridDragDrop {
    constructor(gameState, productGridSystem, workerGridSystem, gameLoopManager) {
        this.gameState = gameState;
        this.productGridSystem = productGridSystem;
        this.workerGridSystem = workerGridSystem;
        this.gameLoopManager = gameLoopManager;
        this.uiOrchestrator = null; // Reference to ProductGridUI (set via setUIOrchestrator)

        // Drag state
        this.draggedArea = null;
        this.draggedWorker = null;
        this.lastCollisionInfo = null;
    }

    /**
     * Set reference to the UI orchestrator (ProductGridUI)
     * Called after ProductGridUI construction to enable callbacks
     */
    setUIOrchestrator(productGridUI) {
        this.uiOrchestrator = productGridUI;
    }

    // ============================================================================
    // AREA PLACEMENT DRAG-DROP (Production Area Placement)
    // ============================================================================

    /**
     * Handle drag start from sidebar area
     */
    handleAreaDragStart(e, facilityId, area) {
        this.draggedArea = {
            areaId: area.id,
            facilityId: facilityId,
            width: area.gridX,
            height: area.gridY
        };

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', area.id);

        // Visual feedback
        e.target.closest('.area-item').classList.add('dragging');
    }

    /**
     * Handle drag end from sidebar area
     */
    handleAreaDragEnd(e) {
        e.target.closest('.area-item')?.classList.remove('dragging');
        this.draggedArea = null;
    }

    /**
     * Handle drag over grid cell
     */
    handleGridDragOver(e) {
        if (!this.draggedArea) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const cell = e.target.closest('.grid-cell');
        const grid = cell?.closest('.product-grid');

        if (grid && cell) {
            const gridX = parseInt(cell.dataset.gridX);
            const gridY = parseInt(cell.dataset.gridY);

            // Clear all previous highlights first
            grid.querySelectorAll('.grid-cell').forEach(c => {
                c.classList.remove('drop-valid', 'drop-invalid');
            });

            // Check if placement is valid
            // Pass isRepositioning=true if we're moving an existing area
            const isRepositioning = this.draggedArea.isRepositioning || false;
            const canPlace = this.productGridSystem.canPlaceArea(
                this.draggedArea.facilityId,
                this.draggedArea.areaId,
                gridX,
                gridY,
                isRepositioning,
                this.draggedArea.placementId  // Pass placementId to exclude self correctly when repositioning
            );

            // Highlight all cells that the area will occupy
            for (let y = 0; y < this.draggedArea.height; y++) {
                for (let x = 0; x < this.draggedArea.width; x++) {
                    const targetX = gridX + x;
                    const targetY = gridY + y;
                    const targetCell = grid.querySelector(
                        `.grid-cell[data-grid-x="${targetX}"][data-grid-y="${targetY}"]`
                    );
                    if (targetCell) {
                        targetCell.classList.add(canPlace ? 'drop-valid' : 'drop-invalid');
                    }
                }
            }
        }
    }

    /**
     * Handle drag leave grid cell
     */
    handleGridDragLeave(e) {
        // Only clear if we're leaving the grid container entirely
        // Check if the relatedTarget (element we're moving to) is outside the grid
        if (e.relatedTarget && !e.relatedTarget.closest?.('.product-grid')) {
            const grid = e.target.closest('.product-grid');
            if (grid) {
                grid.querySelectorAll('.grid-cell').forEach(cell => {
                    cell.classList.remove('drop-valid', 'drop-invalid');
                });
            }
        }
    }

    /**
     * Handle drop on grid cell
     */
    handleGridDrop(e, facilityId) {
        e.preventDefault();

        if (!this.draggedArea || this.draggedArea.facilityId !== facilityId) {
            return;
        }

        const cell = e.target.closest('.grid-cell');
        if (!cell) return;

        const gridX = parseInt(cell.dataset.gridX);
        const gridY = parseInt(cell.dataset.gridY);

        // Get area details for logging
        const area = dataLoader.getProductArea(this.draggedArea.areaId);
        const isRepositioning = this.draggedArea.isRepositioning;
        const placementId = this.draggedArea.placementId || 'unknown';

        let success = false;
        let failureReason = null;

        // Validate before attempting move/place
        if (!area) {
            failureReason = `Area not found: ${this.draggedArea.areaId}`;
        } else if (gridX < 0 || gridY < 0 || gridX + area.gridX > this.productGridSystem.gridState[facilityId]?.width || gridY + area.gridY > this.productGridSystem.gridState[facilityId]?.height) {
            failureReason = `Out of bounds: Target (${gridX}, ${gridY}) + Size (${area.gridX}x${area.gridY}) exceeds grid`;
        } else {
            const collision = this.productGridSystem.checkCollision(facilityId, gridX, gridY, area.gridX, area.gridY, isRepositioning ? this.draggedArea.placementId : null);
            if (collision) {
                failureReason = `Collision detected with ${collision.areaId} at (${collision.gridX}, ${collision.gridY})`;
                // Store collision details for logging
                this.lastCollisionInfo = collision;
            }
        }

        if (!failureReason) {
            if (isRepositioning) {
                // Moving an existing placed area
                // FIX: Pass placementId to ensure correct placement is moved when multiple areas of same type exist
                success = this.productGridSystem.moveArea(
                    facilityId,
                    this.draggedArea.areaId,
                    gridX,
                    gridY,
                    this.draggedArea.placementId  // NEW: Pass UUID for precise targeting
                );
                if (!success) {
                    failureReason = 'Move operation failed (internal error)';
                }
            } else {
                // Placing a new area from sidebar
                success = this.productGridSystem.placeArea(
                    facilityId,
                    this.draggedArea.areaId,
                    gridX,
                    gridY
                );
                if (!success) {
                    failureReason = 'Place operation failed (internal error)';
                }
            }
        }

        if (success) {
            // Log area placement/movement details
            // Find the placement at the exact grid position we just placed/moved to
            // This ensures we get the correct placement when multiple areas of the same type exist
            const placements = this.productGridSystem.getPlacements(facilityId) || [];
            const placement = placements.find(p => p.gridX === gridX && p.gridY === gridY && p.areaId === this.draggedArea.areaId);

            if (placement && area) {
                const zoneKey = `${facilityId}_${this.draggedArea.areaId}_${placement.id}`;
                const assignedWorkers = this.gameState.areaWorkerAssignments[zoneKey] || [];

                console.group(`${isRepositioning ? '📍 Area Moved' : '✨ Area Placed'}: ${area.id}`);
                console.log(`Area UUID (Placement ID): ${placement.id}`);
                console.log(`Grid Position: (${gridX}, ${gridY})`);
                if (isRepositioning) {
                    console.log(`Previous Position: (${this.draggedArea.originalGridX}, ${this.draggedArea.originalGridY})`);
                }
                console.log(`Area Dimensions: ${area.gridX}x${area.gridY}`);
                console.log(`Production Time: ${area.cooltime}s`);
                console.log(`Output Item: ${area.productItem}`);
                console.log(`Max Worker Capacity: ${area.workers}`);
                console.log(`Assigned Workers: ${assignedWorkers.length}/${area.workers}`);
                if (assignedWorkers.length > 0) {
                    const workerDetails = assignedWorkers.map(workerId => {
                        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
                        return worker ? `${worker.name} (Lv${worker.level})` : 'Unknown';
                    });
                    console.log(`  Workers: ${workerDetails.join(', ')}`);
                }
                console.groupEnd();
            }

            // Refresh grid display via orchestrator
            if (this.uiOrchestrator) {
                this.uiOrchestrator.refreshGridDisplay(facilityId);
            }
            // Trigger real-time update of Production panel on area placement
            this.gameLoopManager.uiUpdater.updateProductionPanelForFacility(facilityId);
        } else {
            // Log detailed failure information
            console.group(`❌ Area ${isRepositioning ? 'Move' : 'Place'} Failed: ${this.draggedArea.areaId}`);
            console.log(`Area UUID (Placement ID): ${placementId}`);
            console.log(`Target Position: (${gridX}, ${gridY})`);
            if (isRepositioning) {
                console.log(`Original Position: (${this.draggedArea.originalGridX}, ${this.draggedArea.originalGridY})`);
            }
            if (area) {
                console.log(`Area Dimensions: ${area.gridX}x${area.gridY}`);
            }
            console.log(`Failure Reason: ${failureReason || 'Unknown'}`);

            // If collision failure, include collision area details
            if (this.lastCollisionInfo && failureReason?.includes('Collision')) {
                console.log(`Colliding Area: ${this.lastCollisionInfo.areaId}`);
                console.log(`Colliding Area UUID: ${this.lastCollisionInfo.placementId}`);
                console.log(`Colliding Area Position: (${this.lastCollisionInfo.gridX}, ${this.lastCollisionInfo.gridY})`);
                console.log(`Colliding Area Dimensions: ${this.lastCollisionInfo.width}x${this.lastCollisionInfo.height}`);
                this.lastCollisionInfo = null; // Clear after logging
            }
            console.groupEnd();

            // Clear highlights if placement failed
            const grid = cell.closest('.product-grid');
            if (grid) {
                grid.querySelectorAll('.grid-cell').forEach(c => {
                    c.classList.remove('drop-valid', 'drop-invalid');
                });
            }
        }
    }

    // ============================================================================
    // PLACED AREA REPOSITIONING
    // ============================================================================

    /**
     * Handle drag start from a placed area (for repositioning)
     */
    handlePlacedAreaDragStart(e, facilityId, areaId, placementIndex) {
        // FIX: Use placementIndex directly instead of getPlacement(areaId)
        // getPlacement() searches by areaId only, which fails when multiple areas of the same type exist
        // Always use the index to get the exact placement being dragged
        const placements = this.productGridSystem.getPlacements(facilityId);
        const placement = placements[placementIndex];

        if (!placement) {
            console.error(`❌ Drag Failed: Placement not found at index ${placementIndex}`);
            return;
        }

        // Get placement UUID for logging
        const placementId = placement.id;

        // Log the drag start
        const area = dataLoader.getProductArea(areaId);
        console.group(`🎯 Area Drag Started`);
        console.log(`Area ID: ${areaId}`);
        console.log(`Area Type UUID: ${placementId}`);
        console.log(`Placement Index: ${placementIndex}`);
        console.log(`Grid Position: (${placement.gridX}, ${placement.gridY})`);
        console.log(`Area Dimensions: ${placement.width}x${placement.height}`);
        if (area) {
            console.log(`Max Workers: ${area.workers}`);
        }
        console.groupEnd();

        this.draggedArea = {
            areaId: areaId,
            facilityId: facilityId,
            placementId: placementId,  // NEW: Store UUID for logging
            width: placement.width,
            height: placement.height,
            isRepositioning: true,
            originalIndex: placementIndex,
            originalGridX: placement.gridX,
            originalGridY: placement.gridY
        };

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', areaId);

        // Visual feedback
        e.target.classList.add('dragging');
    }

    /**
     * Handle drag end from a placed area
     */
    handlePlacedAreaDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedArea = null;

        // Clear any grid highlighting
        const grid = document.querySelector('.product-grid');
        if (grid) {
            grid.querySelectorAll('.grid-cell').forEach(cell => {
                cell.classList.remove('drop-valid', 'drop-invalid');
            });
        }
    }

    // ============================================================================
    // WORKER ASSIGNMENT DRAG-DROP
    // ============================================================================

    /**
     * Handle drag start from worker (idle or assigned)
     */
    handleWorkerDragStart(e, workerId, sourceZone) {
        this.draggedWorker = {
            workerId: workerId,
            sourceZone: sourceZone,
            sourceType: sourceZone ? 'assigned' : 'idle'
        };

        e.dataTransfer.effectAllowed = 'move';
        e.target.closest('.worker-slot').classList.add('dragging');

        // Fallback: If sourceZone is falsy, try to get it from event target's data attributes
        if (!sourceZone) {
            const slot = e.target.closest('.worker-slot');
            if (slot && slot.dataset.workerZoneKey) {
                sourceZone = slot.dataset.workerZoneKey;
                this.draggedWorker.sourceZone = sourceZone;
                this.draggedWorker.sourceType = 'assigned';
            }
        }

        // Transform left panel to unassign zone if dragging an assigned worker
        if (sourceZone) {
            this.transformPanelToUnassignZone(sourceZone);
        }
    }

    /**
     * Handle drag end from worker
     */
    handleWorkerDragEnd(e) {
        e.target.closest('.worker-slot')?.classList.remove('dragging');

        // Revert left panel transformation if it was an assigned worker
        if (this.draggedWorker && this.draggedWorker.sourceType === 'assigned') {
            const sourceZone = this.draggedWorker.sourceZone;
            if (sourceZone) {
                this.revertPanelFromUnassignZone(sourceZone);
            }
        }

        this.draggedWorker = null;
    }

    /**
     * Handle drag over worker area container
     * Adds highlight when dragging over the area
     */
    handleWorkerAreaDragOver(e, slotsContainer) {
        e.preventDefault();

        if (!this.draggedWorker) {
            return;
        }

        // Highlight the entire area as a valid drop target
        slotsContainer.classList.add('drop-valid');
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * Handle drag leave worker area container
     * Removes the highlight when dragging out of the area
     */
    handleWorkerAreaDragLeave(e, slotsContainer) {
        slotsContainer.classList.remove('drop-valid');
    }

    /**
     * Handle drop on worker area container
     * Auto-assigns the worker to the first available slot
     */
    handleWorkerAreaDrop(e, zoneKey, facilityId) {
        e.preventDefault();
        e.stopPropagation();

        const slotsContainer = e.target.closest('.worker-slots-container');
        if (slotsContainer) {
            slotsContainer.classList.remove('drop-valid');
        }

        if (!this.draggedWorker) return;

        const workerId = this.draggedWorker.workerId;

        // Get area info
        const workerGridWrapper = e.target.closest('.worker-grid-wrapper');
        let areaId = workerGridWrapper?.dataset.areaId;
        let area = null;

        if (areaId) {
            area = dataLoader.getProductArea(areaId);
        }

        // Fallback: if area not found via attribute, try parsing from zoneKey
        if (!area) {
            const zoneParts = zoneKey.split('_');
            const placementId = zoneParts[zoneParts.length - 1];
            const placements = this.productGridSystem.getPlacements(facilityId) || [];
            const placement = placements.find(p => p.id === placementId);
            if (placement) {
                areaId = placement.areaId;
                area = dataLoader.getProductArea(areaId);
            }
        }

        const requiredWorkers = area?.workers || 0;

        // Find the first available slot
        const occupiedSlots = this.workerGridSystem?.getOccupiedSlots(zoneKey) || {};
        let firstAvailableSlot = null;

        // Iterate through slots to find first empty one (filling from left)
        const totalWorkerGridCells = Math.min(requiredWorkers, Math.max(1, (area?.gridX || 1)) * Math.max(1, (area?.gridY || 1) - 1));
        for (let i = 0; i < totalWorkerGridCells; i++) {
            if (!occupiedSlots.hasOwnProperty(i)) {
                firstAvailableSlot = i;
                break;
            }
        }

        // If no slot available, don't assign
        if (firstAvailableSlot === null) {
            this.draggedWorker = null;
            return;
        }

        let assignmentSuccess = false;

        if (this.draggedWorker.sourceType === 'idle') {
            // Assign idle worker to the zone at the first available slot
            assignmentSuccess = this.gameLoopManager.workerSystem.assignWorkerToZone(workerId, zoneKey, firstAvailableSlot);
        } else if (this.draggedWorker.sourceType === 'assigned') {
            // Worker relocation: unassign from source zone and assign to target zone
            const sourceZone = this.draggedWorker.sourceZone;
            if (sourceZone && sourceZone !== zoneKey) {
                // Different zones - relocate the worker
                this.gameLoopManager.workerSystem.unassignWorkerFromZone(workerId);
                assignmentSuccess = this.gameLoopManager.workerSystem.assignWorkerToZone(workerId, zoneKey, firstAvailableSlot);
            }
        }

        if (assignmentSuccess) {
            // Get the assigned worker for logging
            const assignedWorker = this.gameState.workers.hired.find(w => w.id === workerId);

            // LOG: Worker assignment with stats
            if (assignedWorker) {
                console.group(`✅ Worker Assigned: ${assignedWorker.name}`);
                console.log(`Worker ID: ${workerId}`);
                console.log(`Grade: ${assignedWorker.grade}, Level: ${assignedWorker.level}`);
                console.log(`Stats:`, assignedWorker.stats);
                console.log(`Assigned to Zone: ${zoneKey}`);
                console.log(`Area ID: ${areaId}, Max Workers: ${requiredWorkers}`);
                console.log(`Assigned to Slot: ${firstAvailableSlot} (Auto-assigned to first available)`);
            }

            // FEEDBACK 1: Show assignment success with visual effect on the slot
            const slot = slotsContainer?.querySelector(`[data-slot-index="${firstAvailableSlot}"]`);
            if (slot) {
                slot.classList.add('assignment-success');
                setTimeout(() => slot.classList.remove('assignment-success'), 500);
            }

            // FEEDBACK 2: Check if area is now fully staffed and trigger production
            const assignedWorkerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];
            const isNowFullyStaffed = assignedWorkerIds.length >= requiredWorkers && requiredWorkers > 0;

            if (isNowFullyStaffed) {
                // Calculate and display the new production time with full staffing
                const productionSystem = this.gameLoopManager.productionSystem;
                const statBonus = productionSystem.calculateStatBonus(zoneKey, area, true);
                const speedMultiplier = Math.pow(2, statBonus / 100);
                const modifiedTime = productionSystem.calculateModifiedProductionTime(zoneKey, area);

                // Log the production time calculation
                console.log(`🎯 Area Fully Staffed! Production Details:`);
                console.log(`  Base Production Time: ${area.cooltime}s`);
                console.log(`  Stat Bonus: ${statBonus.toFixed(2)}`);
                console.log(`  Speed Multiplier: ${speedMultiplier.toFixed(2)}x`);
                console.log(`  Reduced Production Time: ${modifiedTime.toFixed(2)}s (${productionSystem.formatTimeHHMMSS(modifiedTime)})`);
                console.groupEnd();

                // Add visual indicator that production will start
                const areaElement = document.querySelector(`.placed-area[data-zone-key="${zoneKey}"]`);
                if (areaElement) {
                    areaElement.classList.remove('needs-workers');
                    // Brief animation to signal production is starting
                    areaElement.classList.add('production-starting');
                    setTimeout(() => areaElement.classList.remove('production-starting'), 600);

                    // Add tooltip or notification showing the new production time
                    const workerGrid = areaElement.querySelector('.worker-grid-wrapper');
                    if (workerGrid) {
                        const notification = document.createElement('div');
                        notification.className = 'production-time-notification';
                        notification.innerHTML = `
                            <div class="notification-content">
                                <div class="production-speed">⚡ ${speedMultiplier.toFixed(2)}x Speed</div>
                                <div class="production-time">${productionSystem.formatTimeHHMMSS(modifiedTime)}/item</div>
                            </div>
                        `;
                        workerGrid.appendChild(notification);
                        setTimeout(() => notification.remove(), 3000);
                    }
                }
            } else if (assignedWorker) {
                console.log(`📊 Staffing Status:`);
                console.log(`  Assigned Workers: ${assignedWorkerIds.length}/${requiredWorkers} (needs ${requiredWorkers - assignedWorkerIds.length} more)`);
                if (area) {
                    console.log(`  Production Time: ${area.cooltime}s`);
                    console.log(`  Output Item: ${area.productItem}`);
                }
                console.groupEnd();
            }

            // FEEDBACK 3: Update UI to reflect changes
            if (this.uiOrchestrator) {
                this.uiOrchestrator.refreshGridDisplay(facilityId);
            }

            // Trigger real-time update of Production panel on worker assignment
            this.gameLoopManager.uiUpdater.updateProductionPanelForFacility(facilityId);

            // Force UI update to ensure immediate feedback
            this.gameLoopManager.uiUpdater.updateUI();
        }

        this.draggedWorker = null;
    }

    /**
     * Handle drag over worker slot
     */
    handleWorkerSlotDragOver(e, slot) {
        e.preventDefault();

        if (!this.draggedWorker) {
            return;
        }

        // Check if slot is empty (only empty slots can receive workers)
        const isEmpty = slot.querySelector('.empty-slot-icon') !== null;

        if (isEmpty) {
            // Accept both idle and assigned workers into empty slots
            slot.classList.add('drop-valid');
            e.dataTransfer.dropEffect = 'move';
        } else {
            slot.classList.add('drop-invalid');
            e.dataTransfer.dropEffect = 'none';
        }
    }

    /**
     * Handle drag leave worker slot
     */
    handleWorkerSlotDragLeave(e, slot) {
        slot.classList.remove('drop-valid', 'drop-invalid');
    }

    /**
     * Handle drop on worker slot
     * Handles assignment, list updates, and production auto-start
     */
    handleWorkerSlotDrop(e, zoneKey, slotIndex, facilityId) {
        e.preventDefault();
        e.stopPropagation();
        const slot = e.target.closest('.worker-slot');
        slot.classList.remove('drop-valid', 'drop-invalid');

        if (!this.draggedWorker) return;

        const workerId = this.draggedWorker.workerId;

        // Only allow dropping into empty slots
        if (!slot.querySelector('.empty-slot-icon')) {
            this.draggedWorker = null;
            return;
        }

        // Get area info before assignment to check staffing requirements
        // Retrieve areaId from the worker grid wrapper element's data attribute for reliability
        const workerGridWrapper = slot.closest('.worker-grid-wrapper');
        let areaId = workerGridWrapper?.dataset.areaId;
        let area = null;

        if (areaId) {
            area = dataLoader.getProductArea(areaId);
        }

        // Fallback: if area not found via attribute, try parsing from zoneKey
        // zoneKey format: facilityId_areaId_placementId (where both areaId and placementId can contain underscores)
        if (!area) {
            const zoneParts = zoneKey.split('_');
            const placementId = zoneParts[zoneParts.length - 1];
            const placements = this.productGridSystem.getPlacements(facilityId) || [];
            const placement = placements.find(p => p.id === placementId);
            if (placement) {
                areaId = placement.areaId;
                area = dataLoader.getProductArea(areaId);
            }
        }

        const requiredWorkers = area?.workers || 0;

        let assignmentSuccess = false;

        if (this.draggedWorker.sourceType === 'idle') {
            // Assign idle worker to the zone at specific slot
            assignmentSuccess = this.gameLoopManager.workerSystem.assignWorkerToZone(workerId, zoneKey, slotIndex);
        } else if (this.draggedWorker.sourceType === 'assigned') {
            // Worker relocation: unassign from source zone and assign to target zone
            const sourceZone = this.draggedWorker.sourceZone;
            if (sourceZone && sourceZone !== zoneKey) {
                // Different zones - relocate the worker
                this.gameLoopManager.workerSystem.unassignWorkerFromZone(workerId);
                assignmentSuccess = this.gameLoopManager.workerSystem.assignWorkerToZone(workerId, zoneKey, slotIndex);
            }
        }

        if (assignmentSuccess) {
            // Get the assigned worker for logging
            const assignedWorker = this.gameState.workers.hired.find(w => w.id === workerId);

            // LOG: Worker assignment with stats
            if (assignedWorker) {
                console.group(`✅ Worker Assigned: ${assignedWorker.name}`);
                console.log(`Worker ID: ${workerId}`);
                console.log(`Grade: ${assignedWorker.grade}, Level: ${assignedWorker.level}`);
                console.log(`Stats:`, assignedWorker.stats);
                console.log(`Assigned to Zone: ${zoneKey}`);
                console.log(`Area ID: ${areaId}, Max Workers: ${requiredWorkers}`);
            }

            // FEEDBACK 1: Show assignment success with visual effect
            slot.classList.add('assignment-success');
            setTimeout(() => slot.classList.remove('assignment-success'), 500);

            // FEEDBACK 2: Check if area is now fully staffed and trigger production
            const assignedWorkerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];
            const isNowFullyStaffed = assignedWorkerIds.length >= requiredWorkers && requiredWorkers > 0;

            if (isNowFullyStaffed) {
                // Calculate and display the new production time with full staffing
                const productionSystem = this.gameLoopManager.productionSystem;
                const statBonus = productionSystem.calculateStatBonus(zoneKey, area, true);
                const speedMultiplier = Math.pow(2, statBonus / 100);
                const modifiedTime = productionSystem.calculateModifiedProductionTime(zoneKey, area);

                // Log the production time calculation
                console.log(`🎯 Area Fully Staffed! Production Details:`);
                console.log(`  Base Production Time: ${area.cooltime}s`);
                console.log(`  Stat Bonus: ${statBonus.toFixed(2)}`);
                console.log(`  Speed Multiplier: ${speedMultiplier.toFixed(2)}x`);
                console.log(`  Reduced Production Time: ${modifiedTime.toFixed(2)}s (${productionSystem.formatTimeHHMMSS(modifiedTime)})`);
                console.groupEnd();

                // Add visual indicator that production will start
                const areaElement = document.querySelector(`.placed-area[data-zone-key="${zoneKey}"]`);
                if (areaElement) {
                    areaElement.classList.remove('needs-workers');
                    // Brief animation to signal production is starting
                    areaElement.classList.add('production-starting');
                    setTimeout(() => areaElement.classList.remove('production-starting'), 600);

                    // Add tooltip or notification showing the new production time
                    const workerGrid = areaElement.querySelector('.worker-grid-wrapper');
                    if (workerGrid) {
                        const notification = document.createElement('div');
                        notification.className = 'production-time-notification';
                        notification.innerHTML = `
                            <div class="notification-content">
                                <div class="production-speed">⚡ ${speedMultiplier.toFixed(2)}x Speed</div>
                                <div class="production-time">${productionSystem.formatTimeHHMMSS(modifiedTime)}/item</div>
                            </div>
                        `;
                        workerGrid.appendChild(notification);
                        setTimeout(() => notification.remove(), 3000);
                    }
                }
            } else if (assignedWorker) {
                console.log(`📊 Staffing Status:`);
                console.log(`  Assigned Workers: ${assignedWorkerIds.length}/${requiredWorkers} (needs ${requiredWorkers - assignedWorkerIds.length} more)`);
                if (area) {
                    console.log(`  Production Time: ${area.cooltime}s`);
                    console.log(`  Output Item: ${area.productItem}`);
                }
                console.groupEnd();
            }

            // FEEDBACK 3: Update UI to reflect changes
            // This includes:
            // - Removing worker from Available Workers list
            // - Updating worker count display
            // - Starting the production system on next game loop
            if (this.gameLoopManager && this.gameLoopManager.uiManager) {
                this.gameLoopManager.uiManager.productGridUI?.refreshGridDisplay(facilityId);
            }

            // Trigger real-time update of Production panel on worker assignment
            this.gameLoopManager.uiUpdater.updateProductionPanelForFacility(facilityId);

            // Force UI update to ensure immediate feedback
            this.gameLoopManager.uiUpdater.updateUI();
        }

        this.draggedWorker = null;
    }

    // ============================================================================
    // PANEL MANAGEMENT (Transform to unassign zone / revert)
    // ============================================================================

    /**
     * Transform left panel to show unassign drop zone
     * @param {string} sourceZone - The zone key the worker was dragged from (format: facilityId_areaId_placementId)
     */
    transformPanelToUnassignZone(sourceZone) {
        // Extract facilityId from sourceZone (format: facilityId_areaId_placementId)
        const facilityId = sourceZone.split('_')[0];

        // Validation check
        if (!facilityId || facilityId === 'undefined') {
            return;
        }

        // Find the area section for this specific facility
        const gridContainerId = `${facilityId}-grid-container`;
        const gridContainer = document.getElementById(gridContainerId);

        if (!gridContainer) {
            return;
        }

        // Try new 3-panel layout structure first
        let panelLayout = gridContainer.querySelector('.facility-three-panel-layout');

        // Fallback to legacy product-grid-container structure
        if (!panelLayout) {
            panelLayout = gridContainer.querySelector('.product-grid-container');
        }

        if (!panelLayout) {
            return;
        }

        // Try to find area section directly by ID (works for new structure)
        let areaSection = document.getElementById(`${facilityId}-area-section`);

        // Fallback: search within panelLayout for area-related content
        if (!areaSection) {
            // For legacy structure, look for the panel-content and search there
            const panelContent = panelLayout.querySelector('.product-grid-panel-content');
            if (panelContent) {
                areaSection = panelContent;
            }
        }

        if (!areaSection) {
            return;
        }

        // Clear the area section content (preserve h3 header)
        while (areaSection.children.length > 1) {
            areaSection.removeChild(areaSection.lastChild);
        }

        // Explicitly hide any idle workers panels
        const idlePanel = areaSection.querySelector('.idle-workers-panel');
        if (idlePanel) {
            idlePanel.style.display = 'none';
        }

        // Create unassign drop zone content
        const unassignZone = document.createElement('div');
        unassignZone.className = 'left-panel-unassign-zone';
        unassignZone.textContent = 'Drop here to unassign worker';

        // Make the area section a drop target
        areaSection.classList.add('unassign-drop-target');
        areaSection.appendChild(unassignZone);

        // Add drop zone handlers
        areaSection.addEventListener('dragover', (e) => {
            if (!this.draggedWorker || this.draggedWorker.sourceType !== 'assigned') {
                return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            areaSection.classList.add('drop-valid');
        }, false);

        areaSection.addEventListener('dragleave', (e) => {
            if (e.target === areaSection) {
                areaSection.classList.remove('drop-valid');
            }
        }, false);

        areaSection.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedWorker && this.draggedWorker.sourceType === 'assigned') {
                // Worker dropped on unassign zone - unassign
                this.gameLoopManager.workerSystem.unassignWorkerFromZone(this.draggedWorker.workerId);

                // Get facility ID from the source zone
                const facilityId = this.draggedWorker.sourceZone.split('_')[0];
                if (this.uiOrchestrator) {
                    this.uiOrchestrator.refreshGridDisplay(facilityId);
                }
            }
            areaSection.classList.remove('drop-valid');
            this.draggedWorker = null;
        }, false);
    }

    /**
     * Revert the left panel back to showing available workers
     * @param {string} sourceZone - The zone key the worker was dragged from (format: facilityId_areaId_placementId)
     */
    revertPanelFromUnassignZone(sourceZone) {
        // Extract facilityId from sourceZone (format: facilityId_areaId_placementId)
        const facilityId = sourceZone.split('_')[0];

        // Find the area section for this specific facility
        const gridContainerId = `${facilityId}-grid-container`;
        const gridContainer = document.getElementById(gridContainerId);
        if (!gridContainer) {
            return;
        }

        // Try new 3-panel layout structure first
        let panelLayout = gridContainer.querySelector('.facility-three-panel-layout');

        // Fallback to legacy product-grid-container structure
        if (!panelLayout) {
            panelLayout = gridContainer.querySelector('.product-grid-container');
        }

        if (!panelLayout) {
            return;
        }

        // Try to find area section directly by ID (works for new structure)
        let areaSection = document.getElementById(`${facilityId}-area-section`);

        // Fallback: search within panelLayout for area-related content
        if (!areaSection) {
            const panelContent = panelLayout.querySelector('.product-grid-panel-content');
            if (panelContent) {
                areaSection = panelContent;
            }
        }

        if (!areaSection) {
            return;
        }

        // Remove unassign styling
        areaSection.classList.remove('unassign-drop-target', 'drop-valid');

        // Clear unassign zone content (preserve h3 header)
        while (areaSection.children.length > 1) {
            areaSection.removeChild(areaSection.lastChild);
        }

        // Reconstruct the idle workers panel
        if (this.uiOrchestrator) {
            const workersPanel = this.uiOrchestrator.createIdleWorkersPanel(facilityId);
            if (workersPanel) {
                const workersH3 = workersPanel.querySelector('h3');
                if (workersH3) workersH3.remove();
                areaSection.appendChild(workersPanel);
            }
        }

        // Clear stored content
        this.originalPanelContent = null;
    }
}
