const { GiftCard } = require('../models');
const logger = require('../utils/logger');

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateGiftCardCode() {
  let part = '';
  for (let i = 0; i < 8; i++) {
    part += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return `MKD-${part}`;
}

async function ensureUniqueCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateGiftCardCode();
    const existing = await GiftCard.findOne({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Could not generate unique gift card code');
}

/**
 * Create a single gift card.
 * @param {{ initialBalance: number, purchasedByUserId?: string, orderId?: string, recipientEmail?: string }}
 */
async function createGiftCard({ initialBalance, purchasedByUserId = null, orderId = null, recipientEmail = null }) {
  const code = await ensureUniqueCode();
  const balance = Math.round(initialBalance * 100) / 100;
  const card = await GiftCard.create({
    code,
    initialBalance: balance,
    balance,
    purchasedByUserId,
    orderId,
    recipientEmail,
    status: 'active'
  });
  return card;
}

/**
 * Check if an order item is a gift card product.
 */
function isGiftCardItem(item) {
  if (!item) return false;
  const id = String(item.id || '');
  const category = String(item.category || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  return id.startsWith('gift-card-') || category === 'gift card' || name.includes('gift card');
}

/**
 * Get gift card value from item (price * quantity).
 */
function getGiftCardValue(item) {
  const price = parseFloat(item.price) || 0;
  const qty = parseInt(item.quantity, 10) || 1;
  return Math.round(price * qty * 100) / 100;
}

/**
 * Create gift card records for all gift card items in the given orders.
 * @param {Array<{ id: string, userId: string, restaurantGroups: object }>} orders
 * @returns {Promise<Array<{ orderId: string, giftCards: Array<{ id: string, code: string, balance: number }> }>>}
 */
async function createGiftCardsFromOrders(orders) {
  const results = [];
  for (const order of orders) {
    const groups = order.restaurantGroups || {};
    const created = [];
    for (const [, group] of Object.entries(groups)) {
      const items = Array.isArray(group.items) ? group.items : (group.items ? Object.values(group.items) : []);
      for (const item of items) {
        if (!isGiftCardItem(item)) continue;
        const value = getGiftCardValue(item);
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        for (let i = 0; i < qty; i++) {
          try {
            const card = await createGiftCard({
              initialBalance: value / qty,
              purchasedByUserId: order.userId,
              orderId: order.id
            });
            created.push({
              id: card.id,
              code: card.code,
              balance: parseFloat(card.balance)
            });
          } catch (err) {
            logger.error('Failed to create gift card from order', { orderId: order.id, err: err.message });
          }
        }
      }
    }
    if (created.length > 0) results.push({ orderId: order.id, giftCards: created });
  }
  return results;
}

/**
 * Deduct amount from gift card. Returns new balance or throws.
 */
async function deductBalance(giftCardId, amount) {
  const card = await GiftCard.findByPk(giftCardId);
  if (!card) throw new Error('Gift card not found');
  if (card.status !== 'active') throw new Error('Gift card is not active');
  const current = parseFloat(card.balance);
  const deduct = Math.round(amount * 100) / 100;
  if (deduct <= 0) return current;
  if (deduct > current) throw new Error('Insufficient gift card balance');
  const newBalance = Math.round((current - deduct) * 100) / 100;
  await card.update({
    balance: newBalance,
    status: newBalance <= 0 ? 'used' : 'active'
  });
  return newBalance;
}

/**
 * After payment succeeds: deduct applied gift card from orders, then create new gift cards from gift card items.
 * @param {Array<Order>} orders - Order instances with restaurantGroups, appliedGiftCard
 */
async function processGiftCardsForPaidOrders(orders) {
  for (const order of orders) {
    const applied = order.appliedGiftCard || (order.get && order.get('appliedGiftCard'));
    if (applied && applied.giftCardId && applied.amountApplied > 0) {
      try {
        await deductBalance(applied.giftCardId, applied.amountApplied);
        logger.info('Gift card applied to order', { orderId: order.id, giftCardId: applied.giftCardId, amount: applied.amountApplied });
      } catch (err) {
        logger.error('Failed to deduct gift card for order', { orderId: order.id, err: err.message });
      }
    }
  }
  const created = await createGiftCardsFromOrders(orders);
  return created;
}

module.exports = {
  generateGiftCardCode,
  ensureUniqueCode,
  createGiftCard,
  createGiftCardsFromOrders,
  deductBalance,
  processGiftCardsForPaidOrders,
  isGiftCardItem,
  getGiftCardValue
};
