/**
 * Synthetic `restaurantId` values for cart grouping when there is no real restaurant row.
 * `mkd-gift-cards` is used by GiftCardPage; `mkd-kiddush` is for Shabbat Kiddush & Shalom Zachor packages.
 * Kiddush lines must not look like gift cards (see backend/services/giftCardService.js isGiftCardItem).
 */
export const MKD_GIFT_CARDS_RESTAURANT_ID = 'mkd-gift-cards';

export const MKD_KIDDUSH_RESTAURANT_ID = 'mkd-kiddush';
export const MKD_KIDDUSH_RESTAURANT_NAME =
  'My Kosher Delivery — Kiddush & Shalom Zachor';
