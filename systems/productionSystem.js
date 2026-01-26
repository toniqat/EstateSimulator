/**
 * Production System
 * Handles zone-based resource production with facility storage
 */
class ProductionSystem {
    constructor(gameState, productGridSystem, facilityStorageManager) {
        this.gameState = gameState;
        this.productGridSystem = productGridSystem;
        this.facilityStorageManager = facilityStorageManager;
        this.onWorkerExpGained = null; // Callback: function(workerId) { } - triggered when worker gains EXP
    }

    /**
     * Update production for all zones in all facilities
     */
    updateProduction(scaledDeltaTime) {
        const productionFacilities = ['farm', 'mine', 'ranch', 'fishery'];

        for (const facilityId of productionFacilities) {
            const placements = this.gameState.gridPlacements[facilityId]?.placements || [];

            for (let i = 0; i < placements.length; i++) {
                this.updateZoneProduction(facilityId, placements[i], scaledDeltaTime);
            }
        }
    }

    /**
     * Calculate stat-based production speed bonus
     * Logs detailed stats when called with logDetails flag
     */
    calculateStatBonus(zoneKey, area, logDetails = false) {
        const assignedWorkerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];
        if (assignedWorkerIds.length === 0) {
            if (logDetails) console.log(`[Zone ${zoneKey}] No workers assigned`);
            return 0;
        }

        // Get worker objects
        const workers = assignedWorkerIds.map(id =>
            this.gameState.workers.hired.find(w => w.id === id)
        ).filter(w => w); // Remove nulls

        if (workers.length === 0) {
            if (logDetails) console.log(`[Zone ${zoneKey}] No valid worker objects found`);
            return 0;
        }

        // Parse requiredStat from area - ensure it's an array
        let requiredStats = area.requiredStat || [];
        if (!Array.isArray(requiredStats)) {
            if (logDetails) console.log(`[Zone ${zoneKey}] requiredStat is not an array:`, requiredStats);
            requiredStats = [];
        }

        if (requiredStats.length === 0) {
            if (logDetails) console.log(`[Zone ${zoneKey}] No required stats defined for area`);
            return 0;
        }

        // Calculate total rate
        const totalRate = requiredStats.reduce((sum, req) => sum + req.rate, 0);

        // Calculate weighted average stat
        let weightedStat = 0;

        if (logDetails) {
            console.group(`📊 Production Stat Calculation for ${zoneKey}`);
            console.log(`Total Workers: ${workers.length}`);
            console.log(`Required Stats (total rate: ${totalRate}):`, requiredStats);
        }

        for (const req of requiredStats) {
            const weight = req.rate / totalRate;
            const statsForThisRequirement = workers.map(w => w.stats[req.statId] || 0);
            const avgStat = statsForThisRequirement.reduce((sum, s) => sum + s, 0) / workers.length;
            const contribution = avgStat * weight;

            weightedStat += contribution;

            if (logDetails) {
                console.log(`  ${req.statId}: weight=${(weight*100).toFixed(1)}%, avg=${avgStat.toFixed(1)}, contribution=${contribution.toFixed(1)}`);
                console.log(`    Individual stats: [${statsForThisRequirement.join(', ')}]`);
            }
        }

        if (logDetails) {
            console.log(`Weighted Stat Bonus: ${weightedStat.toFixed(2)}`);
            console.groupEnd();
        }

        return weightedStat;
    }

    /**
     * Check if an item can be added to facility storage
     * - Returns true if item can stack into an existing slot (not at max stack)
     * - Returns true if an empty slot is available
     * - Returns false if storage is full and item cannot stack
     */
    canAddItemToStorage(facilityId, itemId) {
        const storage = this.gameState.facilityStorage[facilityId];
        if (!storage) return true; // Not initialized yet, can add

        const item = dataLoader.getItem(itemId);
        if (!item) return false;

        const stackLimit = item.stacks || 999;
        const slots = storage.slots;

        // Check if we can stack into an existing slot
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (slot && slot.itemId === itemId && slot.quantity < stackLimit) {
                return true; // Can stack into this slot
            }
        }

        // Check if an empty slot is available
        const hasEmptySlot = slots.some(s => s === null);
        return hasEmptySlot;
    }

    /**
     * Get production items from a zone
     * Returns array of {itemId, itemProductCount} for items produced by this zone
     * Handles both single item (current format) and multiple items (future format)
     */
    getProductionItems(area) {
        if (!area.productItem) return [];

        // If productItem is an array, return it directly (multi-item production)
        if (Array.isArray(area.productItem)) {
            return area.productItem;
        }

        // If productItem is an object, wrap it in an array (single-item production)
        if (typeof area.productItem === 'object' && area.productItem.itemId) {
            return [area.productItem];
        }

        return [];
    }

    /**
     * Award EXP to workers and handle level-ups
     * EXP gained = production time in seconds
     */
    awardWorkerEXP(zoneKey, productionTimeSeconds) {
        const assignedWorkerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];

        for (const workerId of assignedWorkerIds) {
            const worker = this.gameState.workers.hired.find(w => w.id === workerId);
            if (!worker) {
                console.warn(`[EXP] Worker ${workerId} not found in hired workers`);
                continue;
            }

            // Check if worker is at max level
            if (dataLoader.isWorkerAtMaxLevel(worker)) {
                continue; // Don't award EXP to max level workers
            }

            // Award EXP equal to production time in seconds
            const expGain = Math.round(productionTimeSeconds);
            const oldExp = worker.exp || 0;
            worker.exp = oldExp + expGain;


            // Check for level-up
            this.checkAndApplyLevelUp(worker);

            // Trigger callback for UI updates (only update this worker's card)
            if (this.onWorkerExpGained) {
                this.onWorkerExpGained(worker.id);
            }
        }
    }

    /**
     * Check if worker has enough EXP to level up and apply growth
     */
    checkAndApplyLevelUp(worker) {
        const maxLevel = dataLoader.getMaxLevelForGrade(worker.grade);

        while (worker.level < maxLevel) {
            const requiredEXP = dataLoader.getExpRequiredForLevel(worker.level + 1);

            // SAFEGUARD: Prevent infinite loop if expRequired is 0 or undefined
            // This should never happen with correct data, but prevents softlock
            if (!requiredEXP || requiredEXP <= 0) {
                console.error(`[LEVELUP] ⚠️ ERROR: Invalid expRequired (${requiredEXP}) for level ${worker.level + 1}. Check if worker level data is loaded correctly!`);
                break; // Stop level-up loop to prevent infinite loop
            }

            if (worker.exp >= requiredEXP) {
                // Level up!
                worker.exp -= requiredEXP;
                worker.level++;

                // Apply stat growth with weighted probability
                this.applyStatGrowth(worker);
            } else {
                break; // Not enough EXP for next level
            }
        }
    }

    /**
     * Apply stat growth using weighted probability
     * Probability of stat increasing = Stat_Value / Sum_of_All_Stats
     */
    applyStatGrowth(worker) {
        // Initialize baseStats if not present (for migration)
        if (!worker.baseStats) {
            worker.baseStats = { ...worker.stats };
        }

        const totalStats = worker.stats.str + worker.stats.agi + worker.stats.int + worker.stats.end;
        if (totalStats === 0) {
            // Fallback: if all stats are 0 (shouldn't happen), increment a random stat
            const statNames = ['str', 'agi', 'int', 'end'];
            const randomStat = statNames[Math.floor(Math.random() * statNames.length)];
            worker.stats[randomStat]++;
            return;
        }

        // Calculate probability for each stat
        const probabilities = {
            str: worker.stats.str / totalStats,
            agi: worker.stats.agi / totalStats,
            int: worker.stats.int / totalStats,
            end: worker.stats.end / totalStats
        };

        // Select stat using weighted random
        let random = Math.random();
        const statNames = ['str', 'agi', 'int', 'end'];

        for (const statName of statNames) {
            random -= probabilities[statName];
            if (random <= 0) {
                worker.stats[statName]++;
                return;
            }
        }

        // Fallback: last stat
        worker.stats[statNames[statNames.length - 1]]++;
    }

    /**
     * Update production for a single zone
     */
    updateZoneProduction(facilityId, placement, scaledDeltaTime) {
        const area = dataLoader.getProductArea(placement.areaId);
        if (!area || !area.productItem) return;

        const productionItems = this.getProductionItems(area);
        if (productionItems.length === 0) return;

        // Use the production time from the area's cooltime field
        const itemProductTime = area.cooltime || 10;
        // Use the unique placement ID instead of array index
        const placementId = placement.id;
        const zoneKey = `${facilityId}_${placement.areaId}_${placementId}`;

        // Check worker requirement
        const requiredWorkers = area.workers || 0;
        const assignedWorkerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];

        if (assignedWorkerIds.length < requiredWorkers) {
            return; // Stop production - not enough workers
        }

        // Calculate stat-based production speed multiplier
        const statBonus = this.calculateStatBonus(zoneKey, area);
        // Formula: Speed = 2^(statBonus/100)
        // 0 stat = 1x, 100 stat = 2x, 200 stat = 4x, 300 stat = 8x
        const speedMultiplier = Math.pow(2, statBonus / 100);

        // Apply speed multiplier to production
        const adjustedProductionTime = itemProductTime / speedMultiplier;

        // Initialize timer if needed
        if (this.gameState.zoneTimers[zoneKey] === undefined) {
            this.gameState.zoneTimers[zoneKey] = 0;
        }

        // Check if ANY produced item can be added to storage
        // Allow production if at least one item can be added
        let canProduce = false;
        for (const prodItem of productionItems) {
            if (this.canAddItemToStorage(facilityId, prodItem.itemId)) {
                canProduce = true;
                break;
            }
        }

        if (!canProduce) {
            // Mark zone as halted due to full storage
            this.gameState.haltedZones[zoneKey] = true;
            return; // Storage full for all items, stop production
        }

        // Zone can produce - clear halted flag
        delete this.gameState.haltedZones[zoneKey];

        // Update timer with speed multiplier applied
        this.gameState.zoneTimers[zoneKey] += scaledDeltaTime * speedMultiplier;
        const productionIntervalMs = adjustedProductionTime * 1000;

        // Produce items
        while (this.gameState.zoneTimers[zoneKey] >= productionIntervalMs) {
            // Process each produced item individually
            let anyItemAdded = false;

            for (const prodItem of productionItems) {
                const { itemId, itemProductCount } = prodItem;

                // Check if this specific item can be added
                if (!this.canAddItemToStorage(facilityId, itemId)) {
                    // Skip this item if storage full and cannot stack
                    // It will be voided (discarded)
                    continue;
                }

                // Try to add this item
                const result = this.facilityStorageManager.addToFacilityStorage(facilityId, itemId, itemProductCount);
                if (result.added > 0) {
                    anyItemAdded = true;
                }
            }

            // Only consume timer if at least one item was produced
            if (anyItemAdded) {
                // Award EXP to workers when production cycle completes
                this.awardWorkerEXP(zoneKey, adjustedProductionTime);
                this.gameState.zoneTimers[zoneKey] -= productionIntervalMs;
            } else {
                // No items could be added, check if we should continue
                let stillCanProduce = false;
                for (const prodItem of productionItems) {
                    if (this.canAddItemToStorage(facilityId, prodItem.itemId)) {
                        stillCanProduce = true;
                        break;
                    }
                }

                if (!stillCanProduce) {
                    break; // Storage full for all items
                } else {
                    this.gameState.zoneTimers[zoneKey] -= productionIntervalMs;
                }
            }
        }
    }

    /**
     * Collect items from facility storage to stash
     */
    collectFromFacility(facilityId, stashManager) {
        return this.facilityStorageManager.collectAllToStash(facilityId, stashManager);
    }

    /**
     * Format seconds into HH:MM:SS format
     */
    formatTimeHHMMSS(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Calculate the modified production time for a zone based on area and worker stats
     * Applies speed modifier from stat bonus: Speed = 2^(statBonus/100)
     * Returns the modified production time in seconds
     */
    calculateModifiedProductionTime(zoneKey, area) {
        if (!area.productItem) return 0;

        // Get base production time from area's cooltime
        const baseProductionTime = area.cooltime || 10;

        // Calculate speed multiplier from worker stats
        const statBonus = this.calculateStatBonus(zoneKey, area);
        const speedMultiplier = Math.pow(2, statBonus / 100);

        // Return modified production time (in seconds)
        return baseProductionTime / speedMultiplier;
    }

    /**
     * Calculate how many units can be produced in 24 hours
     * Based on the modified production time for the zone
     * Returns an array of {itemId, itemName, quantity24h}
     * Note: Returns base values (0 workers = 1x speed) if zone is not staffed
     */
    calculateYieldPerItem(zoneKey, area, facilityId) {
        if (!area.productItem) return [];

        const productionItems = this.getProductionItems(area);
        if (productionItems.length === 0) return [];

        // Get modified production time (calculates based on assigned workers, or returns base if none assigned)
        const modifiedProductionTime = this.calculateModifiedProductionTime(zoneKey, area);

        // Calculate how many items can be produced in 24 hours (86400 seconds)
        const secondsPer24h = 86400;
        const productionsPerDay = secondsPer24h / modifiedProductionTime;

        return productionItems.map(prodItem => ({
            itemId: prodItem.itemId,
            itemName: dataLoader.getItem(prodItem.itemId)?.name || prodItem.itemId,
            quantity24h: Math.floor(productionsPerDay * prodItem.itemProductCount)
        }));
    }
}
