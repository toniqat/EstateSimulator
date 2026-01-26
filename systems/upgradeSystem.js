/**
 * Upgrade System
 * Handles facility and building upgrades
 */
class UpgradeSystem {
    constructor(gameState, stashManager, facilityStorageManager) {
        this.gameState = gameState;
        this.stashManager = stashManager;
        this.facilityStorageManager = facilityStorageManager;
    }

    /**
     * Normalize requirements array (handle wrapped {value: [...]} format)
     */
    _normalizeRequirements(requirements) {
        if (requirements && typeof requirements === 'object' && !Array.isArray(requirements) && requirements.value) {
            requirements = requirements.value;
        }
        if (!Array.isArray(requirements)) {
            return [];
        }
        return requirements;
    }

    /**
     * Check if a requirement is satisfied
     * Type "item": Check inventory quantity
     * Type "facility": Check facility level
     */
    _checkRequirement(requirement) {
        if (requirement.type === 'facility') {
            const facility = this.gameState.facilities[requirement.param1];
            if (!facility) return { satisfied: false, reason: 'Facility not found' };
            return { satisfied: facility.level >= requirement.param2, reason: null };
        } else if (requirement.type === 'item') {
            const itemId = requirement.param1;
            const required = requirement.param2;
            const have = itemId === 'gold' ? this.gameState.gold : this.stashManager.getItemQuantity(itemId);
            return { satisfied: have >= required, have, required, itemId };
        }
        return { satisfied: false, reason: 'Unknown requirement type' };
    }

    /**
     * Get upgrade cost for a facility (without applying it)
     */
    getUpgradeCost(facilityId, nextLevel) {
        return dataLoader.getUpgradeCost(facilityId, nextLevel);
    }

    /**
     * Check if an upgrade is possible and return status
     */
    canUpgrade(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility) return { canUpgrade: false, reason: 'Facility not found' };

        const nextLevel = facility.level + 1;
        const upgradeCost = dataLoader.getUpgradeCost(facilityId, nextLevel);

        if (!upgradeCost) {
            return { canUpgrade: false, reason: 'Cannot upgrade further' };
        }

        // Check all requirements
        const missingRequirements = [];
        let requirements = this._normalizeRequirements(upgradeCost.requirements || []);

        for (const req of requirements) {
            const check = this._checkRequirement(req);

            if (!check.satisfied) {
                if (req.type === 'item') {
                    missingRequirements.push({
                        type: 'item',
                        itemId: req.param1,
                        required: req.param2,
                        have: check.have
                    });
                } else if (req.type === 'facility') {
                    missingRequirements.push({
                        type: 'facility',
                        facilityId: req.param1,
                        requiredLevel: req.param2,
                        currentLevel: this.gameState.facilities[req.param1]?.level || 0
                    });
                }
            }
        }

        if (missingRequirements.length > 0) {
            return { canUpgrade: false, reason: 'Insufficient requirements', missingRequirements };
        }

        return { canUpgrade: true };
    }

    /**
     * Get upgrade cost details for UI display
     */
    getUpgradeCostDetails(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility) return null;

        const nextLevel = facility.level + 1;
        const upgradeCost = dataLoader.getUpgradeCost(facilityId, nextLevel);

        if (!upgradeCost) return null;

        const costs = [];
        const conditions = [];
        let requirements = this._normalizeRequirements(upgradeCost.requirements || []);

        for (const req of requirements) {
            if (req.type === 'item') {
                const itemId = req.param1;
                const required = req.param2;
                const have = itemId === 'gold' ? this.gameState.gold : this.stashManager.getItemQuantity(itemId);
                const item = dataLoader.getItem(itemId);

                costs.push({
                    type: 'item',
                    itemId: itemId,
                    itemName: item ? item.name : itemId,
                    required,
                    have,
                    isSufficient: have >= required
                });
            } else if (req.type === 'facility') {
                const targetFacility = this.gameState.facilities[req.param1];
                const facilityData = dataLoader.getFacility(req.param1);
                const currentLevel = targetFacility?.level || 0;
                const requiredLevel = req.param2;

                conditions.push({
                    type: 'facility',
                    facilityId: req.param1,
                    facilityName: facilityData?.name || req.param1,
                    requiredLevel,
                    currentLevel,
                    isSatisfied: currentLevel >= requiredLevel
                });
            }
        }

        return { currentLevel: facility.level, nextLevel, costs, conditions };
    }

    /**
     * Upgrade a facility
     */
    upgradeFacility(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility) return false;

        const nextLevel = facility.level + 1;
        const upgradeCost = dataLoader.getUpgradeCost(facilityId, nextLevel);

        if (!upgradeCost) {
            alert('Cannot upgrade further!');
            return false;
        }

        let requirements = this._normalizeRequirements(upgradeCost.requirements || []);

        // First, check all requirements (both item and facility)
        for (const req of requirements) {
            const check = this._checkRequirement(req);

            if (!check.satisfied) {
                if (req.type === 'item') {
                    const item = dataLoader.getItem(req.param1);
                    const itemName = item ? item.name : req.param1;
                    alert(`Not enough ${itemName}! Need ${req.param2}, have ${check.have}`);
                } else if (req.type === 'facility') {
                    const facility = dataLoader.getFacility(req.param1);
                    const facilityName = facility ? facility.name : req.param1;
                    alert(`${facilityName} must be at least level ${req.param2}!`);
                }
                return false;
            }
        }

        // Consume only item-type requirements
        for (const req of requirements) {
            if (req.type === 'item') {
                const itemId = req.param1;
                const count = req.param2;

                if (itemId === 'gold') {
                    this.gameState.gold -= count;
                } else {
                    this.stashManager.removeItemFromStash(itemId, count);
                }
            }
            // Facility-type requirements are NOT consumed
        }

        // Upgrade
        facility.level += 1;

        // Update facility storage capacity if applicable
        if (this.facilityStorageManager) {
            this.facilityStorageManager.upgradeFacilityStorage(facilityId);
        }

        // Log facility upgrade with grouped details
        const facilityData = dataLoader.getFacility(facilityId);
        const facilityName = facilityData ? facilityData.name : facilityId;
        console.groupCollapsed(`⬆️ Facility Upgraded: ${facilityName}`);
        console.log(`Facility ID: ${facilityId}`);
        console.log(`Previous Level: ${facility.level - 1}`);
        console.log(`New Level: ${facility.level}`);
        const itemReqs = requirements.filter(r => r.type === 'item');
        if (itemReqs.length > 0) {
            const itemDetails = itemReqs.map(req => {
                const itemId = req.param1;
                const count = req.param2;
                const item = dataLoader.getItem(itemId);
                const itemName = item ? item.name : itemId;
                return `${itemName} (${count})`;
            });
            console.log(`Items Consumed: ${itemDetails.join(', ')}`);
        }
        console.groupEnd();

        return true;
    }

    /**
     * Check if a facility can be constructed (is unbuilt and has Level 1 requirements met)
     */
    canConstruct(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility) return false;

        // Can only construct unbuilt facilities
        if (facility.level !== 0) return false;

        // Get Level 1 construction requirements
        const constructionCost = dataLoader.getUpgradeCost(facilityId, 1);
        if (!constructionCost) return false;

        // Check all requirements
        let requirements = this._normalizeRequirements(constructionCost.requirements || []);
        for (const req of requirements) {
            const check = this._checkRequirement(req);
            if (!check.satisfied) return false;
        }

        return true;
    }

    /**
     * Get construction cost details for UI display
     * Returns both item costs and facility prerequisites
     */
    getConstructionCostDetails(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility || facility.level !== 0) return null;

        const facilityData = dataLoader.getFacility(facilityId);
        if (!facilityData) return null;

        // Get Level 1 construction requirements
        const constructionCost = dataLoader.getUpgradeCost(facilityId, 1);
        if (!constructionCost) return null;

        const costs = [];
        const conditions = [];
        let requirements = this._normalizeRequirements(constructionCost.requirements || []);

        for (const req of requirements) {
            if (req.type === 'item') {
                const itemId = req.param1;
                const required = req.param2;
                const have = itemId === 'gold' ? this.gameState.gold : this.stashManager.getItemQuantity(itemId);
                const item = dataLoader.getItem(itemId);

                costs.push({
                    itemName: item?.name || itemId.charAt(0).toUpperCase() + itemId.slice(1),
                    required,
                    have,
                    isSufficient: have >= required,
                    itemId
                });
            } else if (req.type === 'facility') {
                const targetFacility = this.gameState.facilities[req.param1];
                const facilityReqData = dataLoader.getFacility(req.param1);
                const currentLevel = targetFacility?.level || 0;
                const requiredLevel = req.param2;

                conditions.push({
                    type: 'facility',
                    facilityId: req.param1,
                    facilityName: facilityReqData?.name || req.param1,
                    requiredLevel,
                    currentLevel,
                    isSatisfied: currentLevel >= requiredLevel
                });
            }
        }

        return {
            facilityName: facilityData.name,
            costs,
            conditions
        };
    }

    /**
     * Construct a new facility (set level to 1)
     */
    constructFacility(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility || facility.level !== 0) return false;

        const constructionCost = dataLoader.getUpgradeCost(facilityId, 1);
        if (!constructionCost) return false;

        // Check all requirements first
        const requirements = this._normalizeRequirements(constructionCost.requirements || []);
        for (const req of requirements) {
            const check = this._checkRequirement(req);
            if (!check.satisfied) return false;
        }

        // Consume only item requirements (same as upgrade system)
        for (const req of requirements) {
            if (req.type === 'item') {
                const itemId = req.param1;
                const count = req.param2;

                if (itemId === 'gold') {
                    this.gameState.gold -= count;
                } else {
                    this.stashManager.removeItemFromStash(itemId, count);
                }
            }
        }

        // Set facility level to 1 (construct it)
        facility.level = 1;

        // Update facility storage capacity if applicable
        if (this.facilityStorageManager) {
            this.facilityStorageManager.upgradeFacilityStorage(facilityId);
        }

        // Log facility construction with grouped details
        const facilityData = dataLoader.getFacility(facilityId);
        const facilityName = facilityData ? facilityData.name : facilityId;
        console.groupCollapsed(`🏗️ Facility Constructed: ${facilityName}`);
        console.log(`Facility ID: ${facilityId}`);
        console.log(`New Level: 1`);
        const itemReqs = requirements.filter(r => r.type === 'item');
        if (itemReqs.length > 0) {
            const itemDetails = itemReqs.map(req => {
                const itemId = req.param1;
                const count = req.param2;
                const item = dataLoader.getItem(itemId);
                const itemName = item ? item.name : itemId;
                return `${itemName} (${count})`;
            });
            console.log(`Items Consumed: ${itemDetails.join(', ')}`);
        }
        console.groupEnd();
        return true;
    }
}
