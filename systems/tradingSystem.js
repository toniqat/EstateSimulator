/**
 * Trading System
 * Handles buying and selling items for gold
 */
class TradingSystem {
    constructor(gameState, stashManager) {
        this.gameState = gameState;
        this.stashManager = stashManager;
    }

    /**
     * Sell items for gold
     */
    sell(itemId, amountToSell) {
        if (amountToSell < 0) {
            alert('Cannot sell negative amount!');
            return false;
        }

        const have = this.stashManager.getItemQuantity(itemId);
        if (have < amountToSell) {
            alert(`Not enough ${itemId}! Have ${have}`);
            return false;
        }

        const tradeData = dataLoader.getTradingPrice(itemId);
        if (!tradeData) {
            alert('Item cannot be sold!');
            return false;
        }

        const totalGold = amountToSell * tradeData.sellPrice;
        this.stashManager.removeItemFromStash(itemId, amountToSell);
        this.gameState.gold += totalGold;

        return true;
    }
}
