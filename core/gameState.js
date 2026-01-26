/**
 * Game State Management
 * Handles core game state including gold, workers, facilities, and stash
 */
class GameState {
    constructor() {
        this.gold = 0;
        this.totalWorkers = 0;
        this.availableWorkers = 0;
        this.gameSpeed = 1;
        this.lastUpdateTime = Date.now();
        this.gameLoopInterval = null;

        // Stash storage
        this.stash = {
            level: 1,
            capacity: 25,
            slots: []
        };

        // Facilities
        this.facilities = {};
        this.productionTimers = {};

        // Zone-based production storage
        this.facilityStorage = {}; // { facilityId: { itemId: quantity, ... } }
        this.zoneTimers = {}; // { "facilityId_areaId_index": currentTimeMs }
        this.gridPlacements = {}; // { facilityId: { width, height, placements: [...] } }
        this.zoneEditMode = {}; // { facilityId: boolean }
        this.areaWorkerAssignments = {}; // { "facilityId_areaId_index": [workerId1, workerId2, ...] }
        this.haltedZones = {}; // { "facilityId_areaId_placementId": true } - tracks zones halted due to full storage or other reasons

        // Worker entity system
        this.workers = {
            hired: [],           // Array of worker entities
            pending: [],         // Array of pending workers (hiring queue)
            maxPending: 3,       // Based on lodge level
            arrivalInterval: 30000,  // Milliseconds between arrivals (baseline at 1x speed)
            scaledElapsed: 0,    // Game-speed-adjusted elapsed time since last arrival
            lastRealTime: 0,     // Timestamp of last update (for delta calculation)
            isPaused: false      // Whether timer is paused (queue is full)
        };

        // Trading Post system
        this.tradingPost = {
            level: 1,                    // Trading Post facility level
            activeOrders: [],            // Array of { id, orderId, regionId, timestamp }
            arrivalInterval: 360000,     // Milliseconds (from tradingUpgrade cooltime * 1000)
            maxQueueSlots: 3,            // From tradingUpgrade
            scaledElapsed: 0,            // Game-speed-adjusted elapsed time
            lastRealTime: 0,             // Timestamp for delta calculation
            isPaused: false              // Pauses when queue full
        };

        // Region reputation tracking
        this.tradingRegions = {};        // { regionId: { level, exp, nextLevelExp } }
    }

    /**
     * Initialize game state from save or defaults
     */
    async initializeState() {
        const loaded = await dataLoader.loadAllData();
        if (!loaded) {
            console.error('Failed to load game data');
            return false;
        }

        // Try to load saved game
        if (!this.loadGame()) {
            // Initialize new game
            // Read initial stash capacity from storageSlots in upgrade data
            const stashUpgrade = dataLoader.getUpgradeCost('stash', 1);
            const initialCapacity = stashUpgrade && stashUpgrade.storageSlots !== undefined ? stashUpgrade.storageSlots : 20;

            this.stash = {
                level: 1,
                capacity: initialCapacity,
                slots: new Array(initialCapacity).fill(null)
            };

            // Initialize facilities
            const allFacilities = dataLoader.getAllFacilities();
            const productionFacilities = ['farm', 'mine', 'ranch', 'fishery', 'lodge'];
            const utilityFacilities = ['stash', 'processing', 'trading'];
            const allFacilitiesToInit = [...productionFacilities, ...utilityFacilities];

            for (const facilityId of allFacilitiesToInit) {
                if (allFacilities[facilityId]) {
                    // Default: start at Level 0
                    let initialLevel = 0;

                    // Auto-unlock exception: if Level 1 has empty requirements, start at Level 1
                    const level1Data = dataLoader.getUpgradeCost(facilityId, 1);
                    if (level1Data) {
                        const requirements = level1Data.requirements;
                        // Check if requirements is empty (null, empty string, or empty array)
                        if (!requirements ||
                            (typeof requirements === 'string' && requirements.trim() === '') ||
                            (Array.isArray(requirements) && requirements.length === 0)) {
                            initialLevel = 1;
                        }
                    }

                    this.facilities[facilityId] = {
                        id: facilityId,
                        level: initialLevel,
                        assignedWorkers: 0
                    };
                    this.productionTimers[facilityId] = 0;
                }
            }

            // Load config - start with 500 Gold
            this.gold = 500;

            // Initialize worker system
            this.workers = {
                hired: [],
                pending: [],
                maxPending: 3,
                arrivalInterval: 30000,
                lastArrivalTime: Date.now()
            };

            // Update legacy counters
            this.totalWorkers = 0;
            this.availableWorkers = 0;

            // Initialize Trading Post
            // Note: level is read from facilities.trading.level, which starts at 0 (unbuilt)
            const tradingFacility = this.facilities.trading;
            const tradingLevel = tradingFacility ? tradingFacility.level : 0;
            const tradingUpgrade = tradingLevel > 0 ? dataLoader.getTradingUpgrade(tradingLevel) : null;

            this.tradingPost = {
                level: tradingLevel,
                activeOrders: [],
                arrivalInterval: tradingUpgrade ? tradingUpgrade.cooltime * 1000 : 0,  // 0 if not built
                maxQueueSlots: tradingUpgrade ? tradingUpgrade.maxQueueSlots : 3,
                scaledElapsed: 0,
                lastRealTime: Date.now(),
                isPaused: false
            };

            // Initialize trading regions
            this.tradingRegions = {};
            const allRegions = dataLoader.getAllTradingRegions();
            for (const region of allRegions) {
                this.tradingRegions[region.id] = {
                    level: 1,
                    exp: 0,
                    nextLevelExp: dataLoader.getRegionLevelExp(region.id, 1)
                };
            }
        }

        return true;
    }

    /**
     * Update game loop timing
     */
    updateTiming() {
        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        return deltaTime * this.gameSpeed;
    }

    /**
     * Save game to localStorage
     */
    saveGame() {
        const saveData = {
            gold: this.gold,
            totalWorkers: this.totalWorkers,
            availableWorkers: this.availableWorkers,
            gameSpeed: this.gameSpeed,
            facilities: this.facilities,
            stash: {
                level: this.stash.level,
                capacity: this.stash.capacity,
                slots: this.stash.slots
            },
            // Zone-based production data
            facilityStorage: this.facilityStorage,
            zoneTimers: this.zoneTimers,
            gridPlacements: this.gridPlacements,
            areaWorkerAssignments: this.areaWorkerAssignments,
            haltedZones: this.haltedZones,
            // Worker grid slot assignments
            workerGrids: game.workerGridSystem ? game.workerGridSystem.workerGrids : {},
            // Worker entity system
            workers: {
                hired: this.workers.hired,
                pending: this.workers.pending,
                maxPending: this.workers.maxPending,
                arrivalInterval: this.workers.arrivalInterval,
                lastArrivalTime: this.workers.lastArrivalTime
            },
            // Trading Post system
            tradingPost: {
                level: this.tradingPost.level,
                activeOrders: this.tradingPost.activeOrders,
                arrivalInterval: this.tradingPost.arrivalInterval,
                maxQueueSlots: this.tradingPost.maxQueueSlots,
                scaledElapsed: this.tradingPost.scaledElapsed,
                lastRealTime: this.tradingPost.lastRealTime,
                isPaused: this.tradingPost.isPaused
            },
            // Trading regions
            tradingRegions: this.tradingRegions
            // NOTE: zoneEditMode is NOT saved (UI state only, defaults to false on load)
        };

        localStorage.setItem('estateSimulatorSave', JSON.stringify(saveData));
        alert('Game saved successfully!');
    }

    /**
     * Load game from localStorage
     */
    loadGame() {
        try {
            const saveData = localStorage.getItem('estateSimulatorSave');
            if (!saveData) return false;

            const data = JSON.parse(saveData);
            this.gold = data.gold || 0;
            this.gameSpeed = data.gameSpeed || 1;
            this.facilities = data.facilities || {};

            // Migrate old saves: apply auto-unlock logic to loaded facilities
            // This fixes issues where facilities should be level 1 but are saved as level 0
            for (const facilityId in this.facilities) {
                const facilityState = this.facilities[facilityId];

                // If facility is level 0, check if it should auto-unlock to level 1
                if (facilityState && facilityState.level === 0) {
                    const level1Data = dataLoader.getUpgradeCost(facilityId, 1);
                    if (level1Data) {
                        const requirements = level1Data.requirements;

                        // Auto-unlock if Level 1 has empty requirements
                        if (!requirements ||
                            (typeof requirements === 'string' && requirements.trim() === '') ||
                            (Array.isArray(requirements) && requirements.length === 0)) {
                            facilityState.level = 1;
                            console.log(`[Game Load] Migrated ${facilityId} to level 1 (auto-unlock)`);
                        }
                    }
                }
            }

            // Load stash and ensure capacity matches current upgrade level
            if (data.stash) {
                this.stash = data.stash;
                // Verify capacity matches the current level's storageSlots value
                const stashUpgrade = dataLoader.getUpgradeCost('stash', this.stash.level);
                if (stashUpgrade && stashUpgrade.storageSlots !== undefined) {
                    const oldCapacity = this.stash.capacity;
                    this.stash.capacity = stashUpgrade.storageSlots;
                    // Resize slots array if necessary
                    if (this.stash.slots.length !== this.stash.capacity) {
                        if (this.stash.slots.length < this.stash.capacity) {
                            // Expand
                            const newSlots = new Array(this.stash.capacity - this.stash.slots.length).fill(null);
                            this.stash.slots = [...this.stash.slots, ...newSlots];
                        } else {
                            // Truncate (shouldn't happen in normal gameplay)
                            this.stash.slots = this.stash.slots.slice(0, this.stash.capacity);
                        }
                    }
                    if (oldCapacity !== this.stash.capacity) {
                        console.log(`[Game Load] Stash capacity verified - Level ${this.stash.level}, Capacity: ${this.stash.capacity} slots (was ${oldCapacity})`);
                    }
                }
            } else {
                // Initialize with level 1 capacity
                const stashUpgrade = dataLoader.getUpgradeCost('stash', 1);
                const initialCapacity = stashUpgrade && stashUpgrade.storageSlots !== undefined ? stashUpgrade.storageSlots : 20;
                this.stash = {
                    level: 1,
                    capacity: initialCapacity,
                    slots: new Array(initialCapacity).fill(null)
                };
            }

            // Initialize production timers
            const productionFacilities = ['farm', 'mine', 'ranch', 'fishery'];
            for (const facilityId of productionFacilities) {
                if (!this.productionTimers[facilityId]) {
                    this.productionTimers[facilityId] = 0;
                }
            }

            // Load zone-based production data
            this.facilityStorage = data.facilityStorage || {};
            this.zoneTimers = data.zoneTimers || {};
            this.gridPlacements = data.gridPlacements || {};
            this.areaWorkerAssignments = data.areaWorkerAssignments || {};
            this.haltedZones = data.haltedZones || {};
            // Store worker grids for later restoration by gameLoopManager
            this.workerGrids = data.workerGrids || null;
            this.zoneEditMode = {}; // Reset edit mode on load

            // Migrate old placement index-based zone keys to new UUID-based keys
            this.migrateToUUIDBasedPlacements();

            // Load worker data with migration from old format
            if (data.workers) {
                // New format - load directly
                this.workers = {
                    hired: data.workers.hired || [],
                    pending: data.workers.pending || [],
                    maxPending: data.workers.maxPending || 3,
                    arrivalInterval: data.workers.arrivalInterval || 30000,
                    lastArrivalTime: data.workers.lastArrivalTime || Date.now()
                };
                this.totalWorkers = this.workers.hired.length;
                this.availableWorkers = this.workers.hired.filter(w => !w.assignedTo).length;
            } else {
                // Old format - migrate
                console.log('Migrating old worker system to new entity system...');

                this.workers = {
                    hired: [],
                    pending: [],
                    maxPending: 3,
                    arrivalInterval: 30000,
                    lastArrivalTime: Date.now()
                };

                // Convert old worker count to entities
                const oldTotal = data.totalWorkers || 0;
                for (let i = 0; i < oldTotal; i++) {
                    const worker = this.generateWorker();
                    if (worker) {
                        this.workers.hired.push(worker);
                    }
                }

                // Assign workers to facilities based on old assignments
                for (const facilityId in this.facilities) {
                    const facility = this.facilities[facilityId];
                    const assignedCount = facility.assignedWorkers || 0;

                    for (let i = 0; i < assignedCount; i++) {
                        const unassignedWorker = this.workers.hired.find(w => !w.assignedTo);
                        if (unassignedWorker) {
                            unassignedWorker.assignedTo = facilityId;
                        }
                    }
                }

                this.totalWorkers = this.workers.hired.length;
                this.availableWorkers = this.workers.hired.filter(w => !w.assignedTo).length;

                console.log('Migration complete:', this.workers.hired.length, 'workers created');
            }

            // Load Trading Post data
            if (data.tradingPost) {
                this.tradingPost = {
                    level: data.tradingPost.level !== undefined ? data.tradingPost.level : (this.facilities.trading?.level || 0),
                    activeOrders: data.tradingPost.activeOrders || [],
                    arrivalInterval: data.tradingPost.arrivalInterval !== undefined ? data.tradingPost.arrivalInterval : 0,
                    maxQueueSlots: data.tradingPost.maxQueueSlots || 3,
                    scaledElapsed: data.tradingPost.scaledElapsed || 0,
                    lastRealTime: Date.now(),
                    isPaused: data.tradingPost.isPaused || false
                };
            } else {
                // Initialize if not in save data - sync with actual facility level
                const tradingFacility = this.facilities.trading;
                const tradingLevel = tradingFacility ? tradingFacility.level : 0;
                const tradingUpgrade = tradingLevel > 0 ? dataLoader.getTradingUpgrade(tradingLevel) : null;

                this.tradingPost = {
                    level: tradingLevel,
                    activeOrders: [],
                    arrivalInterval: tradingUpgrade ? tradingUpgrade.cooltime * 1000 : 0,
                    maxQueueSlots: tradingUpgrade ? tradingUpgrade.maxQueueSlots : 3,
                    scaledElapsed: 0,
                    lastRealTime: Date.now(),
                    isPaused: false
                };
            }

            // Load Trading Regions data
            if (data.tradingRegions) {
                this.tradingRegions = data.tradingRegions;
            } else {
                // Initialize if not in save data
                this.tradingRegions = {};
                const allRegions = dataLoader.getAllTradingRegions();
                for (const region of allRegions) {
                    this.tradingRegions[region.id] = {
                        level: 1,
                        exp: 0,
                        nextLevelExp: dataLoader.getRegionLevelExp(region.id, 1)
                    };
                }
            }

            console.log('Game loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading game:', error);
            return false;
        }
    }

    /**
     * Set game speed
     */
    setGameSpeed(speed) {
        this.gameSpeed = speed;
    }

    /**
     * Generate a random worker entity
     * Uses level-based weighted spawn system based on Lodge level
     */
    generateWorker() {
        // Get lodge level to determine worker grade weights
        const lodgeLevel = this.facilities.lodge ? this.facilities.lodge.level : 1;

        // Use level-based weighted grade selection
        const grade = dataLoader.getRandomWorkerGradeByLevel(lodgeLevel);
        if (!grade) return null;

        const level = Math.floor(Math.random() * grade.maxLevel) + 1;
        const totalStats = level * 4;
        const stats = this.generateRandomStats(totalStats);

        return {
            id: `worker_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            name: dataLoader.getRandomWorkerName(),
            grade: grade.id,
            level: level,
            exp: 0,
            stats: stats,
            baseStats: { ...stats }, // Copy stats as base (bonus starts at 0)
            assignedTo: null
        };
    }

    /**
     * Generate random stat distribution
     */
    generateRandomStats(total) {
        const stats = { str: 0, agi: 0, int: 0, end: 0 };
        let remaining = total;
        const statNames = Object.keys(stats);

        while (remaining > 0) {
            const statName = statNames[Math.floor(Math.random() * statNames.length)];
            stats[statName]++;
            remaining--;
        }

        return stats;
    }

    /**
     * Migrate old index-based placement system to UUID-based system
     * Old format: zoneKey = "facilityId_areaId_INDEX"
     * New format: zoneKey = "facilityId_areaId_UUID"
     *
     * This ensures old saves work with the new UUID-based placement system
     */
    migrateToUUIDBasedPlacements() {
        // Check if placements already have IDs (new format)
        let needsMigration = false;
        for (const facilityId in this.gridPlacements) {
            const facility = this.gridPlacements[facilityId];
            if (facility.placements && facility.placements.length > 0) {
                if (!facility.placements[0].id) {
                    needsMigration = true;
                    break;
                }
            }
        }

        if (!needsMigration) {
            return; // Already migrated or new game
        }

        console.log('Migrating placements from index-based to UUID-based system...');

        // Create mapping of old zone keys to new zone keys
        const keyMapping = {}; // oldKey -> newKey

        // Migrate gridPlacements and add IDs
        for (const facilityId in this.gridPlacements) {
            const facility = this.gridPlacements[facilityId];
            if (!facility.placements) continue;

            for (let i = 0; i < facility.placements.length; i++) {
                const placement = facility.placements[i];
                // Generate UUID if not present
                if (!placement.id) {
                    placement.id = `${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
                }

                // Create mapping for zone key conversion
                const oldZoneKey = `${facilityId}_${placement.areaId}_${i}`;
                const newZoneKey = `${facilityId}_${placement.areaId}_${placement.id}`;
                keyMapping[oldZoneKey] = newZoneKey;
            }
        }

        // Migrate zoneTimers
        const newZoneTimers = {};
        for (const oldKey in this.zoneTimers) {
            const newKey = keyMapping[oldKey] || oldKey;
            newZoneTimers[newKey] = this.zoneTimers[oldKey];
        }
        this.zoneTimers = newZoneTimers;

        // Migrate areaWorkerAssignments
        const newWorkerAssignments = {};
        for (const oldKey in this.areaWorkerAssignments) {
            const newKey = keyMapping[oldKey] || oldKey;
            newWorkerAssignments[newKey] = this.areaWorkerAssignments[oldKey];
        }
        this.areaWorkerAssignments = newWorkerAssignments;

        console.log('Placement migration complete. Converted', Object.keys(keyMapping).length, 'zones to UUID-based keys');
    }
}
