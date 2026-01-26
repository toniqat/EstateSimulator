/**
 * Product Grid System
 * Manages grid placement, collision detection, and production area positioning
 */
class ProductGridSystem {
    constructor(gameState, workerGridSystem) {
        this.gameState = gameState;
        this.workerGridSystem = workerGridSystem;
        this.gridState = {}; // Stores grid placement data per facility
    }

    /**
     * Initialize grid state for a facility
     * Note: gridWidth should always be 6 (fixed columns)
     * gridHeight is determined by the Grid upgrade value (dynamic rows)
     */
    initializeGrid(facilityId, gridWidth, gridHeight) {
        // Force width to 6 columns (if a different width is passed, override it)
        const width = gridWidth || 6;
        const height = gridHeight || 10;

        this.gridState[facilityId] = {
            width: width,
            height: height,
            placements: [] // Array of { areaId, gridX, gridY, width, height }
        };
    }

    /**
     * Generate a unique UUID for a placement
     * @returns {string} Unique identifier
     */
    generatePlacementId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Place a production area on the grid
     * @returns {boolean} True if placement succeeded, false if collision detected
     */
    placeArea(facilityId, areaId, gridX, gridY) {
        if (!this.gridState[facilityId]) {
            return false;
        }

        const area = dataLoader.getProductArea(areaId);
        if (!area) {
            return false;
        }

        // Validate area fits within grid
        if (gridX < 0 || gridY < 0 ||
            gridX + area.gridX > this.gridState[facilityId].width ||
            gridY + area.gridY > this.gridState[facilityId].height) {
            return false;
        }

        // Check for collisions
        if (this.checkCollision(facilityId, gridX, gridY, area.gridX, area.gridY)) {
            return false;
        }

        // Also persist to gameState for save/load and production
        if (!this.gameState.gridPlacements[facilityId]) {
            this.gameState.gridPlacements[facilityId] = {
                width: this.gridState[facilityId].width,
                height: this.gridState[facilityId].height,
                placements: []
            };
        }

        // Generate unique placement ID to prevent collisions
        const placementId = this.generatePlacementId();

        // Create placement object with unique ID
        const placementObj = {
            id: placementId,  // Unique identifier - never changes, even after deletion
            areaId: areaId,
            gridX: gridX,
            gridY: gridY,
            width: area.gridX,
            height: area.gridY
        };

        // Place the area in gridState (for rendering)
        this.gridState[facilityId].placements.push(placementObj);

        // Also persist to gameState
        this.gameState.gridPlacements[facilityId].placements.push(placementObj);

        // Initialize worker grid for this production area
        if (this.workerGridSystem) {
            const zoneKey = `${facilityId}_${areaId}_${placementId}`;
            this.workerGridSystem.initializeWorkerGrid(zoneKey, area.gridX, Math.max(1, area.gridY - 1), area.workers);
        }

        return true;
    }

    /**
     * Remove a production area from the grid
     * @param {string} facilityId - The facility ID
     * @param {number} placementIndex - The index of the specific placement to remove
     */
    removeArea(facilityId, placementIndex) {
        if (!this.gridState[facilityId]) {
            return false;
        }

        const index = placementIndex;
        if (index > -1 && index < this.gridState[facilityId].placements.length) {
            const placement = this.gridState[facilityId].placements[index];
            // Use the unique placement ID instead of index
            const placementId = placement.id;
            const zoneKey = `${facilityId}_${placement.areaId}_${placementId}`;

            // Clean up zone timers for this specific placement FIRST (before removal)
            if (this.gameState.zoneTimers[zoneKey]) {
                delete this.gameState.zoneTimers[zoneKey];
            }

            // Unassign all workers from this specific placement
            if (this.gameState.areaWorkerAssignments[zoneKey]) {
                const workerIds = this.gameState.areaWorkerAssignments[zoneKey];
                for (const workerId of workerIds) {
                    const worker = this.gameState.workers.hired.find(w => w.id === workerId);
                    if (worker) {
                        worker.assignedTo = null;
                    }
                }
                delete this.gameState.areaWorkerAssignments[zoneKey];

                // Clean up worker grid for this specific zone
                if (this.workerGridSystem) {
                    this.workerGridSystem.removeZoneGrid(zoneKey);
                }
            }

            // Now remove from both grid states AFTER cleanup
            this.gridState[facilityId].placements.splice(index, 1);

            // Also remove from gameState
            if (this.gameState.gridPlacements[facilityId]) {
                const gsIndex = this.gameState.gridPlacements[facilityId].placements.findIndex(
                    (p) => p.id === placementId
                );
                if (gsIndex > -1) {
                    this.gameState.gridPlacements[facilityId].placements.splice(gsIndex, 1);
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Check if an area would collide with existing placements
     * Returns collision info instead of just boolean for detailed logging
     * @param {string} facilityId - The facility ID
     * @param {number} gridX - X position
     * @param {number} gridY - Y position
     * @param {number} width - Area width
     * @param {number} height - Area height
     * @param {string} excludePlacementId - Optional: placement ID to exclude from collision (for self-collision check when moving)
     * @returns {object|null} Collision info {colliding: true, placementId, areaId} or null if no collision
     */
    checkCollision(facilityId, gridX, gridY, width, height, excludePlacementId = null) {
        const placements = this.gridState[facilityId].placements;

        for (const placement of placements) {
            // Skip the placement we're excluding (for self-collision check when moving)
            // Use placement.id (UUID) instead of areaId to correctly exclude self when multiple areas of same type exist
            if (excludePlacementId && placement.id === excludePlacementId) {
                continue;
            }

            // Check if rectangles overlap
            if (gridX < placement.gridX + placement.width &&
                gridX + width > placement.gridX &&
                gridY < placement.gridY + placement.height &&
                gridY + height > placement.gridY) {
                return {
                    colliding: true,
                    placementId: placement.id,
                    areaId: placement.areaId,
                    gridX: placement.gridX,
                    gridY: placement.gridY,
                    width: placement.width,
                    height: placement.height
                }; // Collision detected with details
            }
        }

        return null; // No collision
    }

    /**
     * Get all placements for a facility
     */
    getPlacements(facilityId) {
        return this.gridState[facilityId]?.placements || [];
    }

    /**
     * Get a specific placement by area ID
     */
    getPlacement(facilityId, areaId) {
        const placements = this.gridState[facilityId]?.placements || [];
        return placements.find(p => p.areaId === areaId) || null;
    }

    /**
     * Move an existing placement
     * @param {string} facilityId - The facility ID
     * @param {string} areaId - The area ID
     * @param {number} newGridX - New X position
     * @param {number} newGridY - New Y position
     * @param {string} placementId - Optional: UUID of the specific placement (required when multiple areas of same type exist)
     * @returns {boolean} True if move succeeded
     */
    moveArea(facilityId, areaId, newGridX, newGridY, placementId = null) {
        const placements = this.gridState[facilityId]?.placements || [];

        // Find the placement to move
        let index = -1;

        if (placementId) {
            // Use UUID to find the exact placement when multiple areas of same type exist
            index = placements.findIndex(p => p.id === placementId);
        } else {
            // Fall back to areaId search (may be ambiguous if multiple areas of same type exist)
            index = placements.findIndex(p => p.areaId === areaId);
        }

        if (index < 0) {
            return false;
        }

        const placement = placements[index];
        const area = dataLoader.getProductArea(areaId);

        if (!area) {
            return false;
        }

        // Validate new position is within grid bounds
        if (newGridX < 0 || newGridY < 0 ||
            newGridX + area.gridX > this.gridState[facilityId].width ||
            newGridY + area.gridY > this.gridState[facilityId].height) {
            return false;
        }

        // Check for collisions with other areas (exclude self using placementId)
        const collision = this.checkCollision(facilityId, newGridX, newGridY, area.gridX, area.gridY, placement.id);
        if (collision) {
            // Collision detected - log and return false
            console.log(`Area Move Failed - Collision with ${collision.areaId} at (${collision.gridX}, ${collision.gridY})`);
            return false;
        }

        // PRESERVE STATE: Only update grid coordinates, keep workers and production progress
        // Update in gridState
        placement.gridX = newGridX;
        placement.gridY = newGridY;

        // Also update in gameState to ensure persistence
        if (this.gameState.gridPlacements[facilityId]) {
            const gsPlacement = this.gameState.gridPlacements[facilityId].placements.find(p => p.id === placement.id);
            if (gsPlacement) {
                gsPlacement.gridX = newGridX;
                gsPlacement.gridY = newGridY;
            }
        }

        return true;
    }

    /**
     * Clear all placements for a facility
     */
    clearGrid(facilityId) {
        if (this.gridState[facilityId]) {
            this.gridState[facilityId].placements = [];
        }
    }

    /**
     * Check if an area can be placed (for UI validation)
     * @param {string} facilityId - The facility ID
     * @param {string} areaId - The area ID
     * @param {number} gridX - X position
     * @param {number} gridY - Y position
     * @param {boolean} isRepositioning - If true, exclude self from collision check
     * @param {string} placementId - Optional: placement ID to exclude from collision check when repositioning
     */
    canPlaceArea(facilityId, areaId, gridX, gridY, isRepositioning = false, placementId = null) {
        if (!this.gridState[facilityId]) {
            return false;
        }

        const area = dataLoader.getProductArea(areaId);
        if (!area) {
            return false;
        }

        // Validate bounds
        if (gridX < 0 || gridY < 0 ||
            gridX + area.gridX > this.gridState[facilityId].width ||
            gridY + area.gridY > this.gridState[facilityId].height) {
            return false;
        }

        // Check collision, excluding self if repositioning
        // Use placementId instead of areaId to correctly exclude self when multiple areas of same type exist
        const excludeId = isRepositioning ? placementId : null;
        const collision = this.checkCollision(facilityId, gridX, gridY, area.gridX, area.gridY, excludeId);
        return collision === null; // No collision = can place
    }

    /**
     * Update grid dimensions (called when facility is upgraded)
     */
    updateGridDimensions(facilityId, newWidth, newHeight) {
        if (!this.gridState[facilityId]) {
            return false;
        }

        // Only update if dimensions actually changed
        if (this.gridState[facilityId].width !== newWidth ||
            this.gridState[facilityId].height !== newHeight) {
            this.gridState[facilityId].width = newWidth;
            this.gridState[facilityId].height = newHeight;

            // Also update the persisted gameState data to ensure changes survive save/load
            if (!this.gameState.gridPlacements[facilityId]) {
                this.gameState.gridPlacements[facilityId] = {
                    width: newWidth,
                    height: newHeight,
                    placements: []
                };
            } else {
                this.gameState.gridPlacements[facilityId].width = newWidth;
                this.gameState.gridPlacements[facilityId].height = newHeight;
            }

            return true;
        }

        return false;
    }
}
