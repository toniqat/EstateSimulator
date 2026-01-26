/**
 * Crafting System
 * Handles recipe-based crafting with level-based unlocking
 */
class CraftingSystem {
    constructor(stashManager, gameState) {
        this.stashManager = stashManager;
        this.gameState = gameState;
    }

    /**
     * Get the materials array from recipe (handles both old and new formats)
     */
    getMaterials(recipe) {
        if (!recipe) return [];
        // New format: recipe.materials
        if (recipe.materials) return recipe.materials;
        // Old format: recipe.inputs
        if (recipe.inputs) return recipe.inputs;
        return [];
    }

    /**
     * Get output count from recipe (handles both old and new formats)
     */
    getOutputCount(recipe) {
        if (!recipe) return 0;
        // New format: recipe.outputCount
        if (recipe.outputCount !== undefined) return recipe.outputCount;
        // Old format: recipe.outputAmount
        if (recipe.outputAmount !== undefined) return recipe.outputAmount;
        return 0;
    }

    /**
     * Check if a recipe is unlocked at the processing facility's current level
     */
    isRecipeUnlocked(outputItemId) {
        const processing = this.gameState?.facilities?.processing;
        if (!processing) return false; // No processing facility

        return dataLoader.isRecipeUnlocked(outputItemId, processing.level);
    }

    /**
     * Check if an item can be crafted at least once
     */
    canCraft(outputItemId) {
        const recipe = dataLoader.getRecipe(outputItemId);
        if (!recipe) return false;

        // Check if recipe is unlocked
        if (!this.isRecipeUnlocked(outputItemId)) return false;

        // Check if we have enough resources for at least one craft
        const materials = this.getMaterials(recipe);
        for (const material of materials) {
            const have = this.stashManager.getItemQuantity(material.itemId);
            if (have < material.count) {
                return false;
            }
        }

        return true;
    }

    /**
     * Calculate maximum number of times a recipe can be crafted with current inventory
     */
    getMaxCraftableAmount(outputItemId) {
        const recipe = dataLoader.getRecipe(outputItemId);
        if (!recipe) return 0;

        const materials = this.getMaterials(recipe);
        if (materials.length === 0) return 0;

        let maxCraftable = Infinity;

        for (const material of materials) {
            const have = this.stashManager.getItemQuantity(material.itemId);
            const timesCanCraft = Math.floor(have / material.count);
            maxCraftable = Math.min(maxCraftable, timesCanCraft);
        }

        return maxCraftable === Infinity ? 0 : maxCraftable;
    }

    /**
     * Craft an item from recipe
     * @param {string} outputItemId - Item ID to craft
     * @param {number} requestedQuantity - Number of times to craft (default: 1)
     * @returns {number} - Actual number of times crafted (accounts for fallback logic)
     */
    craft(outputItemId, requestedQuantity = 1) {
        const recipe = dataLoader.getRecipe(outputItemId);
        if (!recipe) {
            console.error('Recipe not found for:', outputItemId);
            return 0;
        }

        // Check if recipe is unlocked
        if (!this.isRecipeUnlocked(outputItemId)) {
            console.warn(`Recipe not unlocked for: ${outputItemId}`);
            return 0;
        }

        // Calculate maximum craftable with current inventory
        const maxCraftable = this.getMaxCraftableAmount(outputItemId);

        // Use minimum of requested and maximum craftable (fallback logic)
        const actualQuantity = Math.min(requestedQuantity, maxCraftable);

        if (actualQuantity <= 0) {
            console.warn(`Cannot craft ${outputItemId}: insufficient materials`);
            return 0;
        }

        // Consume inputs (multiply by actual quantity)
        const materials = this.getMaterials(recipe);
        const materialsConsumed = [];
        for (const material of materials) {
            const totalNeeded = material.count * actualQuantity;
            this.stashManager.removeItemFromStash(material.itemId, totalNeeded);
            const materialItem = dataLoader.getItem(material.itemId);
            const materialName = materialItem ? materialItem.name : material.itemId;
            materialsConsumed.push(`${materialName} (${totalNeeded})`);
        }

        // Produce output (multiply by actual quantity)
        const outputCount = this.getOutputCount(recipe);
        const totalProduced = outputCount * actualQuantity;
        this.stashManager.addItemToStash(outputItemId, totalProduced);

        // Log crafting with grouped details
        const outputItem = dataLoader.getItem(outputItemId);
        const outputName = outputItem ? outputItem.name : outputItemId;
        console.groupCollapsed(`🔨 Crafting Complete: ${outputName}`);
        console.log(`Item: ${outputName}`);
        console.log(`Crafted: ${actualQuantity}x (${totalProduced} total produced)`);
        if (materialsConsumed.length > 0) {
            console.log(`Materials Used: ${materialsConsumed.join(', ')}`);
        }
        console.groupEnd();

        return actualQuantity;
    }

    /**
     * Get all available (unlocked) recipes for current processing facility level
     */
    getAvailableRecipes() {
        const processing = this.gameState?.facilities?.processing;
        if (!processing) return [];

        const upgrade = dataLoader.getProcessUpgrade(processing.level);
        if (!upgrade || !upgrade.processList) return [];

        return upgrade.processList;
    }
}
