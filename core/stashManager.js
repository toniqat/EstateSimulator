/**
 * Stash Manager
 * Handles inventory storage and item management
 */
class StashManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Add item to stash with stacking logic
     */
    addItemToStash(itemId, quantity) {
        if (quantity <= 0) return false;

        const item = dataLoader.getItem(itemId);
        if (!item) {
            console.warn(`Item not found: ${itemId}`);
            return false;
        }

        const stackLimit = item.stacks;
        let remaining = quantity;

        // Step 1: Fill existing partial stacks
        for (let i = 0; i < this.gameState.stash.slots.length && remaining > 0; i++) {
            const slot = this.gameState.stash.slots[i];
            if (slot && slot.itemId === itemId && slot.quantity < stackLimit) {
                const spaceInSlot = stackLimit - slot.quantity;
                const toAdd = Math.min(spaceInSlot, remaining);
                slot.quantity += toAdd;
                remaining -= toAdd;
            }
        }

        // Step 2: Create new stacks if items left
        while (remaining > 0) {
            const emptySlotIndex = this.gameState.stash.slots.findIndex(s => s === null);
            if (emptySlotIndex === -1) {
                if (remaining > 0) {
                    console.warn(`Stash is full! Could not add ${remaining} ${itemId}`);
                }
                return remaining === quantity;
            }

            const toAdd = Math.min(stackLimit, remaining);
            this.gameState.stash.slots[emptySlotIndex] = {
                itemId: itemId,
                quantity: toAdd
            };
            remaining -= toAdd;
        }

        return true;
    }

    /**
     * Remove item from stash
     */
    removeItemFromStash(itemId, quantity) {
        if (quantity <= 0) return true;

        let remaining = quantity;

        // Find all stacks and remove from them
        for (let i = this.gameState.stash.slots.length - 1; i >= 0 && remaining > 0; i--) {
            const slot = this.gameState.stash.slots[i];
            if (slot && slot.itemId === itemId) {
                const toRemove = Math.min(slot.quantity, remaining);
                slot.quantity -= toRemove;
                remaining -= toRemove;

                if (slot.quantity === 0) {
                    this.gameState.stash.slots[i] = null;
                }
            }
        }

        if (remaining > 0) {
            console.warn(`Not enough ${itemId} in stash. Needed ${quantity}, removed ${quantity - remaining}`);
            return false;
        }

        return true;
    }

    /**
     * Get total quantity of an item in stash
     */
    getItemQuantity(itemId) {
        let total = 0;
        for (const slot of this.gameState.stash.slots) {
            if (slot && slot.itemId === itemId) {
                total += slot.quantity;
            }
        }
        return total;
    }

    /**
     * Sort stash by item ID
     */
    sortStash() {
        const occupied = this.gameState.stash.slots.filter(s => s !== null);
        occupied.sort((a, b) => a.itemId.localeCompare(b.itemId));
        this.gameState.stash.slots = [
            ...occupied,
            ...new Array(this.gameState.stash.capacity - occupied.length).fill(null)
        ];
    }

    /**
     * Swap slots (for drag-drop)
     */
    swapSlots(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.gameState.stash.capacity ||
            toIndex < 0 || toIndex >= this.gameState.stash.capacity) {
            return;
        }

        const fromSlot = this.gameState.stash.slots[fromIndex];
        const toSlot = this.gameState.stash.slots[toIndex];

        // If dropping onto same item type, try to stack
        if (fromSlot && toSlot && fromSlot.itemId === toSlot.itemId) {
            const item = dataLoader.getItem(fromSlot.itemId);
            const stackLimit = item ? item.stacks : 999;

            const spaceInTo = stackLimit - toSlot.quantity;
            const toMove = Math.min(spaceInTo, fromSlot.quantity);

            toSlot.quantity += toMove;
            fromSlot.quantity -= toMove;

            if (fromSlot.quantity === 0) {
                this.gameState.stash.slots[fromIndex] = null;
            }
        } else {
            // Regular swap
            this.gameState.stash.slots[fromIndex] = toSlot;
            this.gameState.stash.slots[toIndex] = fromSlot;
        }
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
            const have = itemId === 'gold' ? this.gameState.gold : this.getItemQuantity(itemId);
            return { satisfied: have >= required, have, required, itemId };
        }
        return { satisfied: false, reason: 'Unknown requirement type' };
    }

    /**
     * Upgrade stash facility using modern requirements-based system
     * Validates all requirements, consumes resources, and updates capacity from stashUpgrade.csv
     */
    upgradeStash() {
        const nextLevel = this.gameState.stash.level + 1;
        const upgradeCost = dataLoader.getUpgradeCost('stash', nextLevel);

        if (!upgradeCost) {
            alert('Cannot upgrade Stash further!');
            return false;
        }

        // Normalize and check all requirements
        let requirements = this._normalizeRequirements(upgradeCost.requirements || []);

        // First, validate all requirements
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

        // Consume resources (items only, not facilities)
        for (const req of requirements) {
            if (req.type === 'item') {
                const itemId = req.param1;
                const count = req.param2;

                if (itemId === 'gold') {
                    this.gameState.gold -= count;
                } else {
                    this.removeItemFromStash(itemId, count);
                }
            }
        }

        // Record old capacity for slot expansion
        const oldCapacity = this.gameState.stash.capacity;

        // Upgrade level
        this.gameState.stash.level = nextLevel;
        this.gameState.facilities['stash'].level = nextLevel;

        // Read new capacity from stashUpgrade.csv via dataLoader
        const newCapacity = dataLoader.getStashCapacity(nextLevel);
        if (newCapacity === 0) {
            console.warn(`Warning: Stash level ${nextLevel} has no capacity defined in stashUpgrade.csv`);
        }
        this.gameState.stash.capacity = newCapacity;

        // Expand slots array if capacity increased
        if (newCapacity > oldCapacity) {
            const newSlots = new Array(newCapacity - oldCapacity).fill(null);
            this.gameState.stash.slots = [...this.gameState.stash.slots, ...newSlots];
        }

        // Log upgrade with grouped details
        console.groupCollapsed(`⬆️ Stash Upgraded`);
        console.log(`Previous Level: ${nextLevel - 1}`);
        console.log(`New Level: ${nextLevel}`);
        console.log(`Previous Capacity: ${oldCapacity}`);
        console.log(`New Capacity: ${newCapacity}`);
        const itemReqs = requirements.filter(r => r.type === 'item');
        if (itemReqs.length > 0) {
            const itemDetails = itemReqs.map(req => {
                const itemId = req.param1;
                const count = req.param2;
                const item = dataLoader.getItem(itemId);
                const itemName = item ? item.name : itemId;
                return `${itemName} (${count})`;
            });
            console.log(`Resources Consumed: ${itemDetails.join(', ')}`);
        }
        console.groupEnd();

        return true;
    }
}
