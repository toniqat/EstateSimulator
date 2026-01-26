/**
 * Facility Storage Manager
 * Manages grid-based storage for facility-produced items
 * Each facility has a fixed number of storage slots, and items occupy slots based on their max stack value
 */
class FacilityStorageManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Get the storage slot capacity for a facility
     */
    getStorageSlots(facilityId) {
        const facility = this.gameState.facilities[facilityId];
        if (!facility) return 0;

        const upgradeData = dataLoader.getUpgradeCost(facilityId, facility.level);
        return upgradeData ? upgradeData.storageSlots : 0;
    }

    /**
     * Initialize facility storage with empty slots
     * Storage structure: { facilityId: { slots: [{ itemId, quantity, stackSize }, ...] } }
     */
    initializeFacilityStorage(facilityId) {
        const maxSlots = this.getStorageSlots(facilityId);
        if (!this.gameState.facilityStorage[facilityId]) {
            this.gameState.facilityStorage[facilityId] = {
                slots: new Array(maxSlots).fill(null)
            };
        }
    }

    /**
     * Add item to facility storage with slot-based system
     * Items stack within a slot up to their max stack value
     */
    addToFacilityStorage(facilityId, itemId, quantity) {
        this.initializeFacilityStorage(facilityId);

        const item = dataLoader.getItem(itemId);
        if (!item) {
            console.warn(`Item not found: ${itemId}`);
            return { success: false, added: 0 };
        }

        const storage = this.gameState.facilityStorage[facilityId];
        const slots = storage.slots;
        const stackLimit = item.stacks || 999;
        let remaining = quantity;
        let totalAdded = 0;

        // Step 1: Fill existing partial stacks
        for (let i = 0; i < slots.length && remaining > 0; i++) {
            const slot = slots[i];
            if (slot && slot.itemId === itemId && slot.quantity < stackLimit) {
                const spaceInSlot = stackLimit - slot.quantity;
                const toAdd = Math.min(spaceInSlot, remaining);
                slot.quantity += toAdd;
                remaining -= toAdd;
                totalAdded += toAdd;
            }
        }

        // Step 2: Create new stacks if items left and slots available
        while (remaining > 0) {
            const emptySlotIndex = slots.findIndex(s => s === null);
            if (emptySlotIndex === -1) {
                if (remaining > 0 && totalAdded === 0) {
                    console.warn(`Facility ${facilityId} storage is full! Could not add ${remaining} ${itemId}`);
                } else if (remaining > 0) {
                    console.warn(`Facility ${facilityId} storage is full! Could only add ${totalAdded} ${itemId}, lost ${remaining}`);
                }
                break;
            }

            const toAdd = Math.min(stackLimit, remaining);
            slots[emptySlotIndex] = {
                itemId: itemId,
                quantity: toAdd
            };
            remaining -= toAdd;
            totalAdded += toAdd;
        }

        return { success: remaining === 0, added: totalAdded };
    }

    /**
     * Get total quantity of an item in facility storage
     */
    getItemQuantity(facilityId, itemId) {
        this.initializeFacilityStorage(facilityId);
        const slots = this.gameState.facilityStorage[facilityId].slots;
        let total = 0;
        for (const slot of slots) {
            if (slot && slot.itemId === itemId) {
                total += slot.quantity;
            }
        }
        return total;
    }

    /**
     * Remove item from facility storage
     */
    removeFromFacilityStorage(facilityId, itemId, quantity) {
        this.initializeFacilityStorage(facilityId);
        const slots = this.gameState.facilityStorage[facilityId].slots;
        let remaining = quantity;

        // Remove from slots starting from the end
        for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
            const slot = slots[i];
            if (slot && slot.itemId === itemId) {
                const toRemove = Math.min(slot.quantity, remaining);
                slot.quantity -= toRemove;
                remaining -= toRemove;

                if (slot.quantity === 0) {
                    slots[i] = null;
                }
            }
        }

        if (remaining > 0) {
            console.warn(`Not enough ${itemId} in facility ${facilityId}. Needed ${quantity}, removed ${quantity - remaining}`);
            return false;
        }

        return true;
    }

    /**
     * Get used slot count
     */
    getUsedSlotCount(facilityId) {
        this.initializeFacilityStorage(facilityId);
        const slots = this.gameState.facilityStorage[facilityId].slots;
        return slots.filter(s => s !== null).length;
    }

    /**
     * Get all items in facility storage (for display)
     */
    getAllItems(facilityId) {
        this.initializeFacilityStorage(facilityId);
        const slots = this.gameState.facilityStorage[facilityId].slots;
        const items = [];
        for (const slot of slots) {
            if (slot) {
                items.push({
                    itemId: slot.itemId,
                    quantity: slot.quantity,
                    item: dataLoader.getItem(slot.itemId)
                });
            }
        }
        return items;
    }

    /**
     * Collect all items from facility storage to stash
     */
    collectAllToStash(facilityId, stashManager) {
        this.initializeFacilityStorage(facilityId);
        const slots = this.gameState.facilityStorage[facilityId].slots;
        let collected = false;
        let partialCollection = false;
        let itemsNotCollected = [];
        let itemsCollected = [];

        for (let i = slots.length - 1; i >= 0; i--) {
            const slot = slots[i];
            if (slot && slot.quantity > 0) {
                const itemId = slot.itemId;
                const quantityInSlot = slot.quantity;
                const item = dataLoader.getItem(itemId);
                const itemName = item ? item.name : itemId;

                // Record stash quantity before attempting to add
                const stashBefore = stashManager.getItemQuantity(itemId);

                // Try to add items to stash
                // Returns true if ALL items added, false if stash is full/no items added
                const successfullyAddedAll = stashManager.addItemToStash(itemId, quantityInSlot);

                // Calculate how many items actually made it to the stash
                const stashAfter = stashManager.getItemQuantity(itemId);
                const itemsActuallyAdded = stashAfter - stashBefore;

                if (successfullyAddedAll) {
                    // All items successfully added
                    slots[i] = null;
                    collected = true;
                    itemsCollected.push(`${itemName} (${quantityInSlot})`);
                } else if (itemsActuallyAdded > 0) {
                    // Partial addition: some items fit, some didn't
                    slot.quantity -= itemsActuallyAdded;
                    partialCollection = true;
                    collected = true;
                    itemsCollected.push(`${itemName} (${itemsActuallyAdded})`);

                    // Only report items that couldn't be added
                    itemsNotCollected.push(`${itemName} (${slot.quantity})`);

                    // Clear the slot if empty
                    if (slot.quantity === 0) {
                        slots[i] = null;
                    }
                } else {
                    // No items added - stash is completely full
                    partialCollection = true;
                    itemsNotCollected.push(`${itemName} (${quantityInSlot})`);
                }
            }
        }

        // Log collection with grouped details if anything was collected
        if (itemsCollected.length > 0) {
            const facilityData = dataLoader.getFacility(facilityId);
            const facilityName = facilityData ? facilityData.name : facilityId;
            console.groupCollapsed(`📦 Collect All: ${facilityName}`);
            console.log(`Facility: ${facilityName}`);
            console.log(`Items Collected: ${itemsCollected.join(', ')}`);
            if (itemsNotCollected.length > 0) {
                console.log(`Items Left (Stash Full): ${itemsNotCollected.join(', ')}`);
            }
            console.groupEnd();
        }

        return { success: collected, partialCollection, itemsNotCollected };
    }

    /**
     * Get total quantity of item across all slots
     */
    getTotalItemQuantity(facilityId, itemId) {
        this.initializeFacilityStorage(facilityId);
        const slots = this.gameState.facilityStorage[facilityId].slots;
        let total = 0;
        for (const slot of slots) {
            if (slot && slot.itemId === itemId) {
                total += slot.quantity;
            }
        }
        return total;
    }

    /**
     * Update facility storage when facility is upgraded
     */
    upgradeFacilityStorage(facilityId) {
        this.initializeFacilityStorage(facilityId);
        const maxSlots = this.getStorageSlots(facilityId);
        const storage = this.gameState.facilityStorage[facilityId];

        if (storage.slots.length < maxSlots) {
            const newSlots = new Array(maxSlots - storage.slots.length).fill(null);
            storage.slots = [...storage.slots, ...newSlots];
        }
    }
}
