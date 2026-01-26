/**
 * Worker System
 * Manages worker entities, hiring queue, arrivals, and assignments
 */
class WorkerSystem {
    constructor(gameState, workerGridSystem) {
        this.gameState = gameState;
        this.workerGridSystem = workerGridSystem;
    }

    /**
     * Initialize worker system
     */
    initialize() {
        if (!this.gameState.workers) {
            this.gameState.workers = {
                hired: [],
                pending: [],
                maxPending: 3,
                maxWorkers: 5,
                arrivalInterval: 30000,
                lastArrivalTime: Date.now()
            };
        }
        this.updateWorkerCapacity();
    }

    /**
     * Update worker capacity based on lodge level
     * Reads from gameState.facilities.lodge to get the actual facility level
     */
    updateWorkerCapacity() {
        const lodge = this.gameState.facilities.lodge;
        if (!lodge) return;

        // If lodge is not built (Level 0), disable worker arrivals completely
        if (lodge.level === 0) {
            this.gameState.workers.arrivalInterval = 0;
            return;
        }

        const upgradeData = dataLoader.getWorkerUpgrade(lodge.level);
        if (upgradeData) {
            this.gameState.workers.maxPending = upgradeData.maxPending;
            this.gameState.workers.maxWorkers = upgradeData.maxWorkers;
            this.gameState.workers.arrivalInterval = upgradeData.arrivalInterval;

            // Reset timer state when updating from construction/upgrade to restart the countdown
            // This ensures the timer immediately starts counting down with the new interval
            this.gameState.workers.scaledElapsed = 0;
            this.gameState.workers.lastRealTime = Date.now();
            this.gameState.workers.isPaused = false;
        }
    }

    /**
     * Worker arrival logic (called each game loop)
     * Uses game-speed-adjusted elapsed time to keep display stable while accelerating countdown
     * Timer completely pauses when queue is full - no background accumulation
     */
    updateWorkerArrivals(deltaTime) {
        const workers = this.gameState.workers;
        const now = Date.now();

        // Stop worker arrivals if lodge is not built (arrivalInterval = 0)
        if (workers.arrivalInterval <= 0) {
            return;
        }

        // Queue full logic: pause timer completely when queue is full
        if (workers.pending.length >= workers.maxPending) {
            // Mark that we're paused (flag set to true)
            workers.isPaused = true;
            return;
        }

        // If we were paused and queue now has a slot, reset lastRealTime
        // This prevents accumulated pause time from being added to scaledElapsed
        if (workers.isPaused) {
            workers.isPaused = false;
            workers.lastRealTime = now;  // Reset timer reference to current time
            return;  // Skip this frame to avoid large delta on resume
        }

        // Ensure scaledElapsed is initialized (for save/load compatibility)
        if (typeof workers.scaledElapsed !== 'number') {
            workers.scaledElapsed = 0;
        }

        // Track the last real timestamp for delta calculation
        if (!workers.lastRealTime) {
            workers.lastRealTime = now;
            return;  // Skip first frame to avoid large delta
        }

        // Calculate delta time since last update
        const realDelta = now - workers.lastRealTime;
        workers.lastRealTime = now;

        // Accumulate game-speed-adjusted elapsed time
        // At 2x speed: 1 real second = 2 seconds of game time
        workers.scaledElapsed += realDelta * this.gameState.gameSpeed;

        // Check if enough game-time has passed for next arrival
        // Display and countdown use the base interval (always 30 seconds at any speed)
        if (workers.scaledElapsed >= workers.arrivalInterval) {
            const newWorker = this.gameState.generateWorker();
            if (newWorker) {
                workers.pending.push(newWorker);
                workers.scaledElapsed = 0;  // Reset for next cycle
            } else {
                // Worker generation failed (e.g., no grades available)
                // Log warning and reset timer to prevent infinite stall
                console.warn('Failed to generate worker - resetting arrival timer');
                workers.scaledElapsed = 0;  // Still reset to prevent stuck state
            }
        }
    }

    /**
     * Hire a pending worker
     */
    hireWorker(workerId) {
        const workers = this.gameState.workers;
        const workerIndex = workers.pending.findIndex(w => w.id === workerId);

        if (workerIndex === -1) {
            alert('Worker not found!');
            return false;
        }

        // Check if hiring would exceed max workers capacity
        if (workers.hired.length >= workers.maxWorkers) {
            alert(`Worker capacity reached! Maximum: ${workers.maxWorkers}`);
            return false;
        }

        const worker = workers.pending[workerIndex];
        const grade = dataLoader.getWorkerGrade(worker.grade);
        const cost = dataLoader.calculateHiringCost(grade, worker.level);

        if (this.gameState.gold < cost) {
            alert(`Not enough gold! Need ${cost}, have ${this.gameState.gold}`);
            return false;
        }

        // Hire worker
        this.gameState.gold -= cost;
        workers.hired.push(worker);
        workers.pending.splice(workerIndex, 1);

        // Log worker hiring with grouped details
        const requiredExp = dataLoader.getExpRequiredForLevel(worker.level + 1);
        const gradeData = dataLoader.getWorkerGrade(worker.grade);
        const gradeName = gradeData ? gradeData.name : worker.grade;
        console.groupCollapsed(`👤 Worker Hired: ${worker.name}`);
        console.log(`Name: ${worker.name}`);
        console.log(`Grade: ${gradeName}`);
        console.log(`Level: ${worker.level}`);
        console.log(`Hiring Cost: ${cost} gold`);
        console.log(`Next Level EXP Required: ${requiredExp}`);
        console.log(`Workers Hired: ${workers.hired.length}/${workers.maxWorkers}`);
        console.groupEnd();

        // Update legacy counters
        this.gameState.totalWorkers = workers.hired.length;
        this.gameState.availableWorkers = workers.hired.filter(w => !w.assignedTo).length;

        return true;
    }

    /**
     * Dismiss a pending worker from the hiring queue
     */
    dismissWorker(workerId) {
        const workers = this.gameState.workers;
        const workerIndex = workers.pending.findIndex(w => w.id === workerId);

        if (workerIndex === -1) {
            return false;
        }

        workers.pending.splice(workerIndex, 1);
        return true;
    }

    /**
     * Assign worker to facility (increment counter)
     */
    assignWorkerToFacility(workerId, facilityId) {
        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
        if (!worker) return false;

        const facility = this.gameState.facilities[facilityId];
        if (!facility) return false;

        // Unassign from previous facility
        if (worker.assignedTo) {
            const oldFacility = this.gameState.facilities[worker.assignedTo];
            if (oldFacility) {
                oldFacility.assignedWorkers = Math.max(0, oldFacility.assignedWorkers - 1);
            }
        }

        // Assign to new facility
        worker.assignedTo = facilityId;
        facility.assignedWorkers = (facility.assignedWorkers || 0) + 1;

        // Update legacy counters
        this.gameState.availableWorkers = this.gameState.workers.hired.filter(w => !w.assignedTo).length;

        return true;
    }

    /**
     * Unassign worker from facility
     */
    unassignWorker(workerId) {
        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
        if (!worker || !worker.assignedTo) return false;

        const facility = this.gameState.facilities[worker.assignedTo];
        if (facility) {
            facility.assignedWorkers = Math.max(0, facility.assignedWorkers - 1);
        }

        worker.assignedTo = null;
        this.gameState.availableWorkers = this.gameState.workers.hired.filter(w => !w.assignedTo).length;

        return true;
    }

    /**
     * Legacy method - keep for compatibility
     */
    assignWorkers(facilityId, amountToAssign) {
        // Still functional for old UI elements
        if (amountToAssign < 0) {
            alert('Cannot assign negative workers!');
            return false;
        }

        const facility = this.gameState.facilities[facilityId];
        if (!facility) return false;

        const currentAssigned = facility.assignedWorkers;
        const totalAssignedOthers = Object.keys(this.gameState.facilities)
            .filter(f => f !== 'lodge' && f !== facilityId)
            .reduce((sum, f) => sum + this.gameState.facilities[f].assignedWorkers, 0);

        if (totalAssignedOthers + amountToAssign > this.gameState.totalWorkers) {
            alert('Not enough workers available!');
            return false;
        }

        const change = amountToAssign - currentAssigned;
        facility.assignedWorkers = amountToAssign;
        this.gameState.availableWorkers -= change;

        return true;
    }

    /**
     * Get available (unassigned) workers
     */
    getAvailableWorkers() {
        return this.gameState.workers.hired.filter(w => !w.assignedTo);
    }

    /**
     * Get workers assigned to facility
     */
    getWorkersByFacility(facilityId) {
        return this.gameState.workers.hired.filter(w => w.assignedTo === facilityId);
    }

    /**
     * Assign worker to a specific zone (area in facility)
     * @param {string} workerId - Worker ID
     * @param {string} zoneKey - Zone key (facilityId_areaId_placementIndex)
     * @param {number} slotIndex - Optional: specific slot index in worker grid (0-based)
     */
    assignWorkerToZone(workerId, zoneKey, slotIndex = null) {
        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
        if (!worker) return false;

        // Unassign from previous zone
        if (worker.assignedTo) {
            this.unassignWorkerFromZone(workerId);
        }

        // Assign to new zone using WorkerGridSystem if available
        worker.assignedTo = zoneKey;

        if (this.workerGridSystem && this.workerGridSystem.workerGrids[zoneKey]) {
            // If a specific slot is requested, try to assign to that slot
            if (slotIndex !== null) {
                const success = this.workerGridSystem.assignWorkerToSlot(zoneKey, workerId, slotIndex);
                if (!success) {
                    worker.assignedTo = null;
                    return false;
                }
            } else {
                // Auto-assign to first available slot
                const availableSlots = this.workerGridSystem.getAvailableSlots(zoneKey);
                if (availableSlots.length === 0) {
                    worker.assignedTo = null;
                    return false;
                }
                this.workerGridSystem.assignWorkerToSlot(zoneKey, workerId, availableSlots[0]);
            }
        }

        // Maintain backward compatibility with array-based assignments
        if (!this.gameState.areaWorkerAssignments[zoneKey]) {
            this.gameState.areaWorkerAssignments[zoneKey] = [];
        }
        this.gameState.areaWorkerAssignments[zoneKey].push(workerId);

        // Update legacy counters
        this.gameState.availableWorkers = this.gameState.workers.hired.filter(w => !w.assignedTo).length;

        return true;
    }

    /**
     * Unassign worker from a zone
     */
    unassignWorkerFromZone(workerId) {
        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
        if (!worker || !worker.assignedTo) return false;

        const zoneKey = worker.assignedTo;

        // Remove from WorkerGridSystem if it exists
        if (this.workerGridSystem && this.workerGridSystem.workerGrids[zoneKey]) {
            const occupiedSlots = this.workerGridSystem.getOccupiedSlots(zoneKey);
            for (const slotIndex in occupiedSlots) {
                if (occupiedSlots[slotIndex] === workerId) {
                    this.workerGridSystem.removeWorkerFromSlot(zoneKey, parseInt(slotIndex));
                    break;
                }
            }
        }

        // Remove from zone assignments array
        if (this.gameState.areaWorkerAssignments[zoneKey]) {
            this.gameState.areaWorkerAssignments[zoneKey] =
                this.gameState.areaWorkerAssignments[zoneKey].filter(id => id !== workerId);
        }

        // Clear worker's zone reference
        worker.assignedTo = null;

        // Log worker unassignment with grouped details
        const gradeData = dataLoader.getWorkerGrade(worker.grade);
        const gradeName = gradeData ? gradeData.name : worker.grade;
        const zoneKeyParts = zoneKey.split('_');
        const zoneInfo = zoneKeyParts.length > 0 ? zoneKeyParts[0] : zoneKey;
        console.groupCollapsed(`👤 Worker Unassigned: ${worker.name}`);
        console.log(`Name: ${worker.name}`);
        console.log(`Grade: ${gradeName}`);
        console.log(`Level: ${worker.level}`);
        console.log(`Unassigned From: ${zoneInfo}`);
        console.log(`Available Workers: ${this.gameState.workers.hired.filter(w => !w.assignedTo).length}`);
        console.groupEnd();

        // Update legacy counters
        this.gameState.availableWorkers = this.gameState.workers.hired.filter(w => !w.assignedTo).length;

        return true;
    }

    /**
     * Unassign all workers from a zone (called when area is removed)
     */
    unassignAllWorkersFromZone(zoneKey) {
        const workerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];
        for (const workerId of workerIds) {
            const worker = this.gameState.workers.hired.find(w => w.id === workerId);
            if (worker) {
                // Clear worker's zone reference
                worker.assignedTo = null;

                // Also remove from worker grid system if it exists
                if (this.workerGridSystem && this.workerGridSystem.workerGrids[zoneKey]) {
                    const occupiedSlots = this.workerGridSystem.getOccupiedSlots(zoneKey);
                    for (const slotIndex in occupiedSlots) {
                        if (occupiedSlots[slotIndex] === workerId) {
                            this.workerGridSystem.removeWorkerFromSlot(zoneKey, parseInt(slotIndex));
                            break;
                        }
                    }
                }
            }
        }
        delete this.gameState.areaWorkerAssignments[zoneKey];

        // Update legacy counters
        this.gameState.availableWorkers = this.gameState.workers.hired.filter(w => !w.assignedTo).length;
    }

    /**
     * Fire (remove) a hired worker
     */
    fireWorker(workerId) {
        const workers = this.gameState.workers;
        const workerIndex = workers.hired.findIndex(w => w.id === workerId);

        if (workerIndex === -1) {
            return false;
        }

        const worker = workers.hired[workerIndex];
        const wasAssigned = worker.assignedTo ? true : false;
        const assignedFacility = wasAssigned ? worker.assignedTo : null;

        // Unassign worker if they are assigned
        if (worker.assignedTo) {
            this.unassignWorkerFromZone(workerId);
        }

        // Remove from hired workers
        workers.hired.splice(workerIndex, 1);

        // Log worker firing with grouped details
        const gradeData = dataLoader.getWorkerGrade(worker.grade);
        const gradeName = gradeData ? gradeData.name : worker.grade;
        console.groupCollapsed(`🗑️ Worker Fired: ${worker.name}`);
        console.log(`Name: ${worker.name}`);
        console.log(`Grade: ${gradeName}`);
        console.log(`Level: ${worker.level}`);
        if (wasAssigned) {
            console.log(`Was Assigned To: ${assignedFacility} (unassigned)`);
        }
        console.log(`Workers Remaining: ${workers.hired.length}/${workers.maxWorkers}`);
        console.groupEnd();

        // Update legacy counters
        this.gameState.totalWorkers = workers.hired.length;
        this.gameState.availableWorkers = workers.hired.filter(w => !w.assignedTo).length;

        return true;
    }

    /**
     * Get workers assigned to a specific zone
     */
    getWorkersByZone(zoneKey) {
        const workerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];
        return workerIds.map(id =>
            this.gameState.workers.hired.find(w => w.id === id)
        ).filter(w => w); // Remove nulls
    }

    /**
     * Get zone worker slot information
     */
    getZoneWorkerSlots(zoneKey, requiredWorkers) {
        const assigned = this.getWorkersByZone(zoneKey);
        return {
            required: requiredWorkers,
            assigned: assigned.length,
            workers: assigned
        };
    }
}
