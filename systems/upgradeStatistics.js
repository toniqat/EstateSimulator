/**
 * Upgrade Statistics System
 * Generates "Before & After" comparison data for upgrade modals
 */
class UpgradeStatistics {
    constructor(gameState, stashManager, dataLoader) {
        this.gameState = gameState;
        this.stashManager = stashManager;
        this.dataLoader = dataLoader;
    }

    /**
     * Format time in milliseconds to HH:MM:SS format
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Get statistics for Stash upgrade
     */
    getStashStatistics(currentLevel, nextLevel) {
        const stats = [];

        // Use dedicated stash upgrade methods instead of general upgrade tree
        const currentCapacity = this.dataLoader.getStashCapacity(currentLevel);
        const nextCapacity = this.dataLoader.getStashCapacity(nextLevel);

        // Only show stat if capacities are defined
        if (currentCapacity === 0 && nextCapacity === 0) {
            return stats;
        }

        stats.push({
            label: 'Inventory Capacity',
            before: currentCapacity,
            after: nextCapacity,
            format: 'slots'
        });

        return stats;
    }

    /**
     * Get statistics for Worker's Lodge upgrade
     */
    getWorkerLodgeStatistics(currentLevel, nextLevel) {
        const stats = [];

        const currentWorkerUpgrade = this.dataLoader.getWorkerUpgrade(currentLevel);
        const nextWorkerUpgrade = this.dataLoader.getWorkerUpgrade(nextLevel);

        if (!currentWorkerUpgrade || !nextWorkerUpgrade) return stats;

        // Hiring Slots (maxPending)
        stats.push({
            label: 'Hiring Slots',
            before: currentWorkerUpgrade.maxPending || 0,
            after: nextWorkerUpgrade.maxPending || 0,
            format: 'count'
        });

        // Arrival Time (arrivalInterval in milliseconds)
        stats.push({
            label: 'Arrival Time',
            before: this.formatTime(currentWorkerUpgrade.arrivalInterval || 0),
            after: this.formatTime(nextWorkerUpgrade.arrivalInterval || 0),
            format: 'time'
        });

        // Max Workers (maxWorkers)
        stats.push({
            label: 'Max Workers',
            before: currentWorkerUpgrade.maxWorkers || 0,
            after: nextWorkerUpgrade.maxWorkers || 0,
            format: 'count'
        });

        return stats;
    }

    /**
     * Get statistics for Production Facilities (Farm, Mine, Ranch, Fishery)
     */
    getProductionFacilityStatistics(facilityId, currentLevel, nextLevel) {
        const stats = [];

        const currentUpgrade = this.dataLoader.getUpgradeCost(facilityId, currentLevel);
        const nextUpgrade = this.dataLoader.getUpgradeCost(facilityId, nextLevel);

        if (!currentUpgrade || !nextUpgrade) return stats;

        // Grid Size (Fixed width of 6, calculate rows)
        const currentGridWidth = 6;
        const nextGridWidth = 6;
        const currentGridHeight = currentUpgrade.Grid || 0;
        const nextGridHeight = nextUpgrade.Grid || 0;

        stats.push({
            label: 'Area',
            before: `${currentGridWidth}x${currentGridHeight}`,
            after: `${nextGridWidth}x${nextGridHeight}`,
            format: 'grid'
        });

        // Storage (storageSlots)
        const currentStorage = currentUpgrade.storageSlots || 0;
        const nextStorage = nextUpgrade.storageSlots || 0;

        stats.push({
            label: 'Storage',
            before: currentStorage,
            after: nextStorage,
            format: 'slots'
        });

        // Product Areas (Zone Availability)
        const productAreaStats = this.compareProductAreas(currentUpgrade, nextUpgrade);
        if (productAreaStats.length > 0) {
            stats.push({
                label: 'Zones',
                changes: productAreaStats,
                format: 'zones'
            });
        }

        return stats;
    }

    /**
     * Compare product areas between two upgrade levels
     */
    compareProductAreas(currentUpgrade, nextUpgrade) {
        const changes = [];

        const currentAreas = this.parseProductAreas(currentUpgrade.productAreas);
        const nextAreas = this.parseProductAreas(nextUpgrade.productAreas);

        // Find new zones
        for (const areaId in nextAreas) {
            if (!(areaId in currentAreas)) {
                const areaName = this.getProductAreaName(areaId);
                changes.push({
                    type: 'new',
                    name: areaName,
                    text: `New: ${areaName}`
                });
            }
        }

        // Find removed zones
        for (const areaId in currentAreas) {
            if (!(areaId in nextAreas)) {
                const areaName = this.getProductAreaName(areaId);
                changes.push({
                    type: 'removed',
                    name: areaName,
                    text: `Removed: ${areaName}`
                });
            }
        }

        // Find quantity changes
        for (const areaId in currentAreas) {
            if (areaId in nextAreas) {
                const currentQty = currentAreas[areaId];
                const nextQty = nextAreas[areaId];

                if (currentQty !== nextQty) {
                    const areaName = this.getProductAreaName(areaId);
                    const currentDisplay = currentQty === -1 ? 'Unlimited' : currentQty;
                    const nextDisplay = nextQty === -1 ? 'Unlimited' : nextQty;
                    changes.push({
                        type: 'change',
                        name: areaName,
                        text: `${areaName}: ${currentDisplay} → ${nextDisplay}`
                    });
                }
            }
        }

        return changes;
    }

    /**
     * Parse productAreas JSON string
     */
    parseProductAreas(areaJson) {
        if (!areaJson) return {};
        if (typeof areaJson === 'string') {
            try {
                return JSON.parse(areaJson);
            } catch (e) {
                return {};
            }
        }
        return areaJson;
    }

    /**
     * Get human-readable name for product area ID
     */
    getProductAreaName(areaId) {
        // Map area IDs to display names
        const areaNames = {
            // Farm
            'farm_basic': 'Farm - Basic',
            'farm_basic2': 'Farm - Basic 2',
            'farm_basic3': 'Farm - Basic 3',
            'farm_basic4': 'Farm - Basic 4',
            'farm_basic5': 'Farm - Basic 5',
            'farm_basic6': 'Farm - Basic 6',
            'farm_basic7': 'Farm - Basic 7',
            'farm_medium': 'Farm - Medium',
            'farm_medium1': 'Farm - Medium 1',
            'farm_medium2': 'Farm - Medium 2',
            'farm_advanced': 'Farm - Advanced',
            'farm_advanced1': 'Farm - Advanced 1',
            'farm_advanced2': 'Farm - Advanced 2',
            'farm_advanced3': 'Farm - Advanced 3',
            // Mine
            'mine_basic': 'Mine - Basic',
            'mine_medium': 'Mine - Medium',
            'mine_advanced': 'Mine - Advanced',
            // Ranch
            'ranch_basic': 'Ranch - Basic',
            'ranch_medium': 'Ranch - Medium',
            'ranch_advanced': 'Ranch - Advanced',
            // Fishery
            'fishery_basic': 'Fishery - Basic',
            'fishery_medium': 'Fishery - Medium',
            'fishery_advanced': 'Fishery - Advanced'
        };
        return areaNames[areaId] || areaId;
    }

    /**
     * Get statistics for Processing Plant upgrade
     */
    getProcessingPlantStatistics(currentLevel, nextLevel) {
        const stats = [];

        const currentProcess = this.dataLoader.getProcessUpgrade(currentLevel);
        const nextProcess = this.dataLoader.getProcessUpgrade(nextLevel);

        if (!currentProcess || !nextProcess) return stats;

        const recipeChanges = this.compareRecipes(currentProcess, nextProcess);
        if (recipeChanges.length > 0) {
            stats.push({
                label: 'Recipes',
                changes: recipeChanges,
                format: 'recipes'
            });
        }

        return stats;
    }

    /**
     * Compare recipes between two processing levels
     */
    compareRecipes(currentProcess, nextProcess) {
        const changes = [];

        const currentRecipes = this.parseRecipeList(currentProcess.processList);
        const nextRecipes = this.parseRecipeList(nextProcess.processList);

        // Find unlocked recipes
        for (const recipe of nextRecipes) {
            if (!currentRecipes.includes(recipe)) {
                const itemName = this.getItemName(recipe);
                changes.push({
                    type: 'unlocked',
                    itemId: recipe,
                    text: `Unlocked: ${itemName}`
                });
            }
        }

        // Find removed recipes
        for (const recipe of currentRecipes) {
            if (!nextRecipes.includes(recipe)) {
                const itemName = this.getItemName(recipe);
                changes.push({
                    type: 'removed',
                    itemId: recipe,
                    text: `Removed: ${itemName}`
                });
            }
        }

        return changes;
    }

    /**
     * Parse recipe list JSON string
     */
    parseRecipeList(recipeJson) {
        if (!recipeJson) return [];
        if (typeof recipeJson === 'string') {
            try {
                return JSON.parse(recipeJson);
            } catch (e) {
                return [];
            }
        }
        return Array.isArray(recipeJson) ? recipeJson : [];
    }

    /**
     * Get item name by ID
     */
    getItemName(itemId) {
        const item = this.dataLoader.getItem(itemId);
        return item ? item.name : itemId;
    }

    /**
     * Get statistics for Trading Post upgrade
     */
    getTradingPostStatistics(currentLevel, nextLevel) {
        const stats = [];

        const currentTrading = this.dataLoader.getTradingUpgrade(currentLevel);
        const nextTrading = this.dataLoader.getTradingUpgrade(nextLevel);

        if (!currentTrading || !nextTrading) return stats;

        // Max Orders (maxQueueSlots)
        stats.push({
            label: 'Max Orders',
            before: currentTrading.maxQueueSlots || 0,
            after: nextTrading.maxQueueSlots || 0,
            format: 'count'
        });

        // Arrival Time (cooltime in seconds)
        const currentCooltime = this.formatTime((currentTrading.cooltime || 0) * 1000);
        const nextCooltime = this.formatTime((nextTrading.cooltime || 0) * 1000);

        stats.push({
            label: 'Arrival Time',
            before: currentCooltime,
            after: nextCooltime,
            format: 'time'
        });

        // Reliability Cooldown (same as cooltime in this case)
        stats.push({
            label: 'Reliability Cooldown',
            before: currentCooltime,
            after: nextCooltime,
            format: 'time'
        });

        return stats;
    }

    /**
     * Get all statistics for a facility upgrade
     */
    getUpgradeStatistics(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility) return null;

        const currentLevel = facility.level;
        const nextLevel = currentLevel + 1;

        let statistics = [];

        // Route to appropriate statistics getter based on facility type
        if (facilityId === 'stash') {
            statistics = this.getStashStatistics(currentLevel, nextLevel);
        } else if (facilityId === 'lodge') {
            statistics = this.getWorkerLodgeStatistics(currentLevel, nextLevel);
        } else if (['farm', 'mine', 'ranch', 'fishery'].includes(facilityId)) {
            statistics = this.getProductionFacilityStatistics(facilityId, currentLevel, nextLevel);
        } else if (facilityId === 'processing') {
            statistics = this.getProcessingPlantStatistics(currentLevel, nextLevel);
        } else if (facilityId === 'trading') {
            statistics = this.getTradingPostStatistics(currentLevel, nextLevel);
        }

        return {
            facilityId,
            currentLevel,
            nextLevel,
            statistics
        };
    }
}
