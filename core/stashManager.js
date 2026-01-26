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
     * Upgrade stash facility
     */
    upgradeStash() {
        const nextLevel = this.gameState.stash.level + 1;
        const upgradeCost = dataLoader.getUpgradeCost('stash', nextLevel);

        if (!upgradeCost) {
            alert('Cannot upgrade stash further!');
            return false;
        }

        // Check gold
        if (this.gameState.gold < upgradeCost.goldCost) {
            alert(`Not enough gold! Need ${upgradeCost.goldCost}, have ${this.gameState.gold}`);
            return false;
        }

        // Check materials
        for (const materialId of upgradeCost.materials) {
            const required = upgradeCost.materials.filter(m => m === materialId).length;
            const have = this.getItemQuantity(materialId);
            if (have < required) {
                const item = dataLoader.getItem(materialId);
                const itemName = item ? item.name : materialId;
                alert(`Not enough ${itemName}! Need ${required}, have ${have}`);
                return false;
            }
        }

        // Consume costs
        this.gameState.gold -= upgradeCost.goldCost;
        for (const materialId of upgradeCost.materials) {
            this.removeItemFromStash(materialId, 1);
        }

        // Upgrade
        this.gameState.stash.level = nextLevel;
        this.gameState.facilities['stash'].level = nextLevel;
        const oldCapacity = this.gameState.stash.capacity;

        // Read new capacity from stash upgrade data
        const newCapacity = dataLoader.getStashCapacity(nextLevel);
        this.gameState.stash.capacity = newCapacity;

        // Expand slots array
        const newSlots = new Array(this.gameState.stash.capacity - oldCapacity).fill(null);
        this.gameState.stash.slots = [...this.gameState.stash.slots, ...newSlots];

        return true;
    }
}
