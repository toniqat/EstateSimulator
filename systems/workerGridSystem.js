/**
 * Worker Grid System
 * Manages independent worker slot grids within production areas
 * Each area has its own grid layout independent of the facility grid
 */
class WorkerGridSystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.workerGrids = {}; // Stores worker grid data per zone (facilityId_areaId_placement)
    }

    /**
     * Initialize worker grid for a production area placement
     * @param {string} zoneKey - Unique key for the zone (facilityId_areaId_placementIndex)
     * @param {number} gridWidth - Worker grid width (columns)
     * @param {number} gridHeight - Worker grid height (rows)
     * @param {number} totalSlots - Total worker slots needed
     */
    initializeWorkerGrid(zoneKey, gridWidth, gridHeight, totalSlots) {
        this.workerGrids[zoneKey] = {
            gridWidth: gridWidth,
            gridHeight: gridHeight,
            totalSlots: totalSlots,
            occupancy: {}, // Maps slot index to worker ID
            layout: this.generateGridLayout(gridWidth, gridHeight, totalSlots)
        };
    }

    /**
     * Generate slot layout based on grid dimensions
     * @returns {Array} Array of slot positions [{x, y, slotIndex}, ...]
     */
    generateGridLayout(gridWidth, gridHeight, totalSlots) {
        const layout = [];
        let slotIndex = 0;

        for (let y = 0; y < gridHeight && slotIndex < totalSlots; y++) {
            for (let x = 0; x < gridWidth && slotIndex < totalSlots; x++) {
                layout.push({
                    x: x,
                    y: y,
                    slotIndex: slotIndex
                });
                slotIndex++;
            }
        }

        return layout;
    }

    /**
     * Get grid dimensions for an area
     */
    getGridDimensions(zoneKey) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return null;

        return {
            width: grid.gridWidth,
            height: grid.gridHeight,
            totalSlots: grid.totalSlots
        };
    }

    /**
     * Get all slot positions for a grid
     */
    getGridLayout(zoneKey) {
        const grid = this.workerGrids[zoneKey];
        return grid ? grid.layout : [];
    }

    /**
     * Get a specific slot position by index
     */
    getSlotPosition(zoneKey, slotIndex) {
        const layout = this.getGridLayout(zoneKey);
        return layout.find(slot => slot.slotIndex === slotIndex) || null;
    }

    /**
     * Check if a slot is occupied
     */
    isSlotOccupied(zoneKey, slotIndex) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return false;
        return grid.occupancy.hasOwnProperty(slotIndex);
    }

    /**
     * Assign worker to a specific slot
     * @returns {boolean} True if assignment succeeded
     */
    assignWorkerToSlot(zoneKey, workerId, slotIndex) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return false;

        // Check if slot exists and is empty
        if (slotIndex < 0 || slotIndex >= grid.totalSlots) {
            return false;
        }

        if (grid.occupancy.hasOwnProperty(slotIndex)) {
            return false; // Slot already occupied
        }

        // Remove worker from any other slot in this zone
        for (const slot in grid.occupancy) {
            if (grid.occupancy[slot] === workerId) {
                delete grid.occupancy[slot];
                break;
            }
        }

        // Assign to new slot
        grid.occupancy[slotIndex] = workerId;
        return true;
    }

    /**
     * Get worker ID from a specific slot
     */
    getWorkerAtSlot(zoneKey, slotIndex) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return null;
        return grid.occupancy[slotIndex] || null;
    }

    /**
     * Get all occupied slots for a zone
     */
    getOccupiedSlots(zoneKey) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return {};
        return { ...grid.occupancy };
    }

    /**
     * Get all workers assigned to a zone (in slot order)
     */
    getWorkersInZone(zoneKey) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return [];

        const workers = [];
        for (let i = 0; i < grid.totalSlots; i++) {
            if (grid.occupancy.hasOwnProperty(i)) {
                workers.push(grid.occupancy[i]);
            }
        }
        return workers;
    }

    /**
     * Get available (empty) slots in a zone
     */
    getAvailableSlots(zoneKey) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return [];

        const available = [];
        for (let i = 0; i < grid.totalSlots; i++) {
            if (!grid.occupancy.hasOwnProperty(i)) {
                available.push(i);
            }
        }
        return available;
    }

    /**
     * Get worker slot information for display
     */
    getSlotInfo(zoneKey, slotIndex) {
        const grid = this.workerGrids[zoneKey];
        if (!grid) return null;

        const position = this.getSlotPosition(zoneKey, slotIndex);
        const workerId = grid.occupancy[slotIndex] || null;

        return {
            slotIndex: slotIndex,
            position: position,
            occupied: grid.occupancy.hasOwnProperty(slotIndex),
            workerId: workerId,
            gridX: position ? position.x : null,
            gridY: position ? position.y : null
        };
    }

    /**
     * Remove worker from a slot (unassign)
     */
    removeWorkerFromSlot(zoneKey, slotIndex) {
        const grid = this.workerGrids[zoneKey];
        if (!grid || !grid.occupancy.hasOwnProperty(slotIndex)) {
            return null;
        }

        const workerId = grid.occupancy[slotIndex];
        delete grid.occupancy[slotIndex];
        return workerId;
    }

    /**
     * Clear all workers from a zone (when area is removed)
     */
    clearZoneWorkers(zoneKey) {
        const grid = this.workerGrids[zoneKey];
        if (grid) {
            grid.occupancy = {};
        }
    }

    /**
     * Remove a zone's grid entirely
     */
    removeZoneGrid(zoneKey) {
        delete this.workerGrids[zoneKey];
    }

    /**
     * Get all zone grids (for debugging/display)
     */
    getAllGrids() {
        return this.workerGrids;
    }

    /**
     * Validate grid dimensions against slot count
     */
    validateGridDimensions(gridWidth, gridHeight, totalSlots) {
        const maxSlots = gridWidth * gridHeight;
        return totalSlots <= maxSlots;
    }
}
