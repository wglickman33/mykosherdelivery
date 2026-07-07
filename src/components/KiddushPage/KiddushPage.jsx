import './KiddushPage.scss';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Footer from '../Footer/Footer';
import { useCart } from '../../context/CartContext';
import navyMKDIcon from '../../assets/navyMKDIcon.png';
import { fetchKiddushPackages } from '../../services/kiddushPackageService';
import {
  MKD_KIDDUSH_RESTAURANT_ID,
  MKD_KIDDUSH_RESTAURANT_NAME
} from '../../constants/mkdCartSentinels';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { buildImageUrl } from '../../services/imageService';
import MenuItemModal from '../MenuItemModal/MenuItemModal';

const SIZE_ORDER = ['8_12', '15_20', '25_plus'];

const sizeTierLabel = (tier) => {
  switch (tier) {
    case '8_12':
      return '8-12 guests';
    case '15_20':
      return '15-20 guests';
    case '25_plus':
      return '25+ guests';
    default:
      return tier;
  }
};

const sizeTierShort = (tier) => {
  switch (tier) {
    case '8_12':
      return '8-12';
    case '15_20':
      return '15-20';
    case '25_plus':
      return '25+';
    default:
      return tier;
  }
};

const categoryTitle = (cat) =>
  cat === 'shalom_zachor' ? 'Shalom Zachor Options' : 'Kiddush Options';

const categoryLabel = (cat) =>
  cat === 'shalom_zachor' ? 'Shalom Zachor' : 'Kiddush';

const lineCategoryForPackage = (cat) =>
  cat === 'shalom_zachor' ? 'Shalom Zachor package' : 'Kiddush package';

const KIDDUSH_ROUTES = {
  kiddush: '/kiddush',
  shalom_zachor: '/kiddush/shalom-zachor'
};

const categoryFromPath = (pathname) =>
  pathname.startsWith(KIDDUSH_ROUTES.shalom_zachor) ? 'shalom_zachor' : 'kiddush';

const PAGE_COPY = {
  kiddush: {
    title: 'Kiddush',
    subtitle:
      'Configure a Kiddush package for your Shabbat gathering. Pick a guest count, review what\u2019s included, customize your selections, and add it to your cart alongside restaurant orders for one checkout and delivery.',
    howItWorks: [
      'Pick a guest count tier for your Kiddush.',
      'Customize your package and add it to your cart alongside meals from our restaurants.',
      'One checkout. Delivery follows our usual Friday schedule.'
    ]
  },
  shalom_zachor: {
    title: 'Shalom Zachor',
    subtitle:
      'Configure a Shalom Zachor package to welcome your new arrival. Pick a guest count, review what\u2019s included, customize your selections, and add it to your cart alongside restaurant orders for one checkout and delivery.',
    howItWorks: [
      'Pick a guest count tier for your Shalom Zachor.',
      'Customize your package and add it to your cart alongside meals from our restaurants.',
      'One checkout. Delivery follows our usual Friday schedule.'
    ]
  }
};

const cleanDisplayText = (text) => {
  if (!text) return '';
  return String(text).replace(/\u2014/g, ', ').replace(/\u2013/g, '-');
};

const getItemTypeLabel = (itemType) => {
  switch (itemType) {
    case 'variety':
      return 'Variable item';
    case 'builder':
      return 'Configurable item';
    default:
      return null;
  }
};

const itemRequiresConfiguration = (item) =>
  item?.itemType === 'variety' || item?.itemType === 'builder';

const getCustomizeActionLabel = (item, configured) => {
  if (item.itemType === 'variety') {
    return configured ? 'Edit option' : 'Choose option';
  }
  if (item.itemType === 'builder') {
    return configured ? 'Edit selection' : 'Customize';
  }
  return configured ? 'Edit' : 'Customize';
};

const normalizeMenuItemForModal = (item) => ({
  ...item,
  image: item.imageUrl ? buildImageUrl(item.imageUrl) : navyMKDIcon,
  options: item.options || null,
  itemType: item.itemType || 'simple'
});

const isItemConfigured = (item, configuredItems) => {
  if (!itemRequiresConfiguration(item)) return true;
  const configured = configuredItems[item.id];
  if (!configured) return false;
  if (item.itemType === 'variety') return !!configured.selectedVariant;
  if (item.itemType === 'builder') {
    if (!item.options?.configurations?.length) return true;
    return item.options.configurations.every((config) => {
      if (!config.required) return true;
      const selections = configured.selectedConfigurations || [];
      return selections.some((sel) => sel.category === config.category);
    });
  }
  return true;
};

const getMenuItemPriceAdjustment = (item, configuredItems) => {
  const configured = configuredItems[item.id];
  if (!configured) return 0;
  return Number(configured.price ?? item.price) - Number(item.price ?? 0);
};

const buildPackageConfigurationSignature = (packageId, configuredItems) => {
  const parts = Object.keys(configuredItems)
    .sort()
    .map((itemId) => {
      const configured = configuredItems[itemId];
      if (configured.selectedVariant) {
        const variantId = configured.selectedVariant.id || configured.selectedVariant.name;
        return `${itemId}:v:${variantId}`;
      }
      if (configured.selectedConfigurations?.length) {
        const options = configured.selectedConfigurations.map((sel) => sel.option).join(',');
        return `${itemId}:b:${options}`;
      }
      return `${itemId}:s`;
    });
  return `kiddush-${packageId}-${parts.join('|')}`;
};

const serializeConfiguredMenuItems = (menuItems, configuredItems) =>
  menuItems.map((item) => {
    const configured = configuredItems[item.id];
    if (!configured) {
      return {
        menuItemId: item.id,
        name: item.name,
        itemType: item.itemType || 'simple',
        category: item.category,
        included: true
      };
    }
    return {
      menuItemId: item.id,
      name: configured.name || item.name,
      itemType: item.itemType || 'simple',
      category: item.category,
      price: Number(configured.price ?? item.price),
      selectedVariant: configured.selectedVariant || null,
      selectedConfigurations: configured.selectedConfigurations || null
    };
  });

/** Package menu items from admin (preferred). */
const getPackageMenuItems = (pkg) => {
  if (!pkg || !Array.isArray(pkg.menuItems)) return [];
  return pkg.menuItems.filter((item) => item.available !== false);
};

/** Rows for the package builder UI. */
const getPackageBuilderRows = (pkg) => {
  const menuItems = getPackageMenuItems(pkg);
  return menuItems.map((item) => ({
    key: item.id,
    item,
    name: cleanDisplayText(item.name),
    subtitle: item.description ? cleanDisplayText(item.description) : null,
    typeLabel: getItemTypeLabel(item.itemType),
    section: item.category ? cleanDisplayText(item.category) : null,
    requiresConfiguration: itemRequiresConfiguration(item)
  }));
};

function sortBySizeTier(a, b) {
  const ia = SIZE_ORDER.indexOf(a.sizeTier);
  const ib = SIZE_ORDER.indexOf(b.sizeTier);
  if (ia === -1 && ib === -1) return 0;
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export default function KiddushPage() {
  const location = useLocation();
  const category = categoryFromPath(location.pathname);
  const pageCopy = PAGE_COPY[category];

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailPkg, setDetailPkg] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [configuredItems, setConfiguredItems] = useState({});
  const [configuringItem, setConfiguringItem] = useState(null);
  const isAddingRef = useRef(false);
  const { addToCart } = useCart();

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchKiddushPackages();
    setPackages(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setDetailPkg(null);
    setQuantity(1);
    setIsAdded(false);
    setConfiguredItems({});
    setConfiguringItem(null);
    isAddingRef.current = false;
  }, [category]);

  const filtered = useMemo(() => {
    return packages
      .filter((p) => p.category === category)
      .sort((a, b) => {
        const oa = a.displayOrder ?? 0;
        const ob = b.displayOrder ?? 0;
        if (oa !== ob) return oa - ob;
        return sortBySizeTier(a, b);
      });
  }, [packages, category]);

  const detailBuilderRows = useMemo(
    () => (detailPkg ? getPackageBuilderRows(detailPkg) : []),
    [detailPkg]
  );

  const detailMenuItems = useMemo(
    () => (detailPkg ? getPackageMenuItems(detailPkg) : []),
    [detailPkg]
  );

  const configurableMenuItems = useMemo(
    () => detailMenuItems.filter((item) => itemRequiresConfiguration(item)),
    [detailMenuItems]
  );

  const hasConfigurableItems = configurableMenuItems.length > 0;

  const allConfigurableItemsConfigured = useMemo(
    () => configurableMenuItems.every((item) => isItemConfigured(item, configuredItems)),
    [configurableMenuItems, configuredItems]
  );

  const canAddPackageToCart = !hasConfigurableItems || allConfigurableItemsConfigured;

  const menuItemCountFor = useCallback(
    (pkg) => getPackageMenuItems(pkg).length,
    []
  );

  const kiddushRestaurant = useMemo(
    () => ({
      id: MKD_KIDDUSH_RESTAURANT_ID,
      name: MKD_KIDDUSH_RESTAURANT_NAME,
      logo: navyMKDIcon
    }),
    []
  );

  useEffect(() => {
    if (detailPkg) {
      setQuantity(1);
      setIsAdded(false);
      setConfiguredItems({});
      setConfiguringItem(null);
      isAddingRef.current = false;
    }
  }, [detailPkg]);

  const detailUnitPrice = detailPkg
    ? detailMenuItems.reduce(
        (sum, item) => sum + getMenuItemPriceAdjustment(item, configuredItems),
        Number(detailPkg.price)
      )
    : 0;
  const detailTotalPrice = (detailUnitPrice * quantity).toFixed(2);

  const closeDetail = () => {
    if (isAdded || isAddingRef.current) return;
    setDetailPkg(null);
    setQuantity(1);
    setConfiguredItems({});
    setConfiguringItem(null);
  };

  const handleQuantityChange = (change) => {
    setQuantity((prev) => Math.max(1, prev + change));
  };

  const handleConfiguredMenuItem = (configuredItem) => {
    if (!configuringItem) return;
    setConfiguredItems((prev) => ({
      ...prev,
      [configuringItem.id]: configuredItem
    }));
    setConfiguringItem(null);
  };

  const handleAddToCart = () => {
    if (!detailPkg || isAdded || isAddingRef.current || !canAddPackageToCart) return;

    isAddingRef.current = true;
    setIsAdded(true);

    const desc =
      detailPkg.shortDescription ||
      `${categoryTitle(detailPkg.category)}, ${sizeTierLabel(detailPkg.sizeTier)}`;

    const configurationSignature = buildPackageConfigurationSignature(
      detailPkg.id,
      configuredItems
    );

    const cartItem = {
      id: detailPkg.id,
      name: cleanDisplayText(detailPkg.name),
      price: detailUnitPrice,
      description: cleanDisplayText(desc),
      itemType: 'kiddush_package',
      category: lineCategoryForPackage(detailPkg.category),
      image: detailPkg.imageUrl ? buildImageUrl(detailPkg.imageUrl) : navyMKDIcon,
      kiddushPackageId: detailPkg.id,
      configurationSignature,
      metadata: {
        kiddushPackageId: detailPkg.id,
        category: detailPkg.category,
        sizeTier: detailPkg.sizeTier,
        basePackagePrice: Number(detailPkg.price),
        configuredMenuItems: serializeConfiguredMenuItems(detailMenuItems, configuredItems)
      }
    };

    addToCart(cartItem, quantity, kiddushRestaurant);

    setTimeout(() => {
      isAddingRef.current = false;
      setIsAdded(false);
      setDetailPkg(null);
      setQuantity(1);
      setConfiguredItems({});
      setConfiguringItem(null);
    }, 1500);
  };

  return (
    <div className="kiddush-page">
      <div className="kiddush-page__content">
        <div className="kiddush-header">
          <Link to="/home" className="back-link">
            ← Back to Home
          </Link>
          <div className="kiddush-hero">
            <div className="kiddush-logo">
              <img src={navyMKDIcon} alt="My Kosher Delivery logo" />
            </div>
            <div className="kiddush-hero__text">
              <h1 className="kiddush-title">{pageCopy.title}</h1>
              <p className="kiddush-subtitle">{pageCopy.subtitle}</p>
            </div>
          </div>
        </div>

        <nav className="kiddush-category-tabs" aria-label="Package type">
          <NavLink
            to={KIDDUSH_ROUTES.kiddush}
            end
            className={({ isActive }) => `kiddush-tab${isActive ? ' is-active' : ''}`}
          >
            Kiddush Options
          </NavLink>
          <NavLink
            to={KIDDUSH_ROUTES.shalom_zachor}
            className={({ isActive }) => `kiddush-tab${isActive ? ' is-active' : ''}`}
          >
            Shalom Zachor Options
          </NavLink>
        </nav>

        {loading ? (
          <div className="kiddush-loading">
            <LoadingSpinner size="medium" text="Loading packages..." variant="primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="kiddush-empty">
            No active packages in this category yet. Please check back soon or
            browse{' '}
            <Link to="/restaurants">restaurants</Link>.
          </p>
        ) : (
          <section className="kiddush-grid-section" aria-labelledby="kiddush-size-heading">
            <h2 id="kiddush-size-heading" className="kiddush-section-title">
              {categoryTitle(category)}
            </h2>
            <div className="kiddush-size-grid">
              {filtered.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  className="kiddush-size-card"
                  onClick={() => setDetailPkg(pkg)}
                >
                  <span className="kiddush-size-card__headline">{sizeTierShort(pkg.sizeTier)}</span>
                  <span className="kiddush-size-card__guests">guests</span>
                  <span className="kiddush-size-card__name">
                    {pkg.category === 'shalom_zachor' ? 'Shalom Zachor' : 'Kiddush'}
                  </span>
                  <span className="kiddush-size-card__price">
                    ${Number(pkg.price).toFixed(2)}
                  </span>
                  {menuItemCountFor(pkg) > 0 && (
                    <span className="kiddush-size-card__hint">
                      {menuItemCountFor(pkg)} menu item{menuItemCountFor(pkg) === 1 ? '' : 's'}
                    </span>
                  )}
                  {!menuItemCountFor(pkg) && pkg.shortDescription && (
                    <span className="kiddush-size-card__hint">
                      {cleanDisplayText(pkg.shortDescription)}
                    </span>
                  )}
                  <span className="kiddush-size-card__cta">Customize Package</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {detailPkg && (
          <div
            className="kiddush-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiddush-modal-title"
            onClick={closeDetail}
          >
            <div className="kiddush-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="kiddush-modal__close"
                aria-label="Close"
                onClick={closeDetail}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  />
                </svg>
              </button>

              <div className="kiddush-modal__image">
                <img
                  src={
                    detailPkg.imageUrl
                      ? buildImageUrl(detailPkg.imageUrl)
                      : navyMKDIcon
                  }
                  alt={`${categoryLabel(detailPkg.category)} package, ${sizeTierLabel(detailPkg.sizeTier)}`}
                  className={!detailPkg.imageUrl ? 'kiddush-modal__image--placeholder' : ''}
                  onError={(e) => {
                    e.target.src = navyMKDIcon;
                    e.target.classList.add('kiddush-modal__image--placeholder');
                  }}
                />
              </div>

              <div className="kiddush-modal__content">
                <h2 id="kiddush-modal-title" className="kiddush-modal__title">
                  {categoryLabel(detailPkg.category)},{' '}
                  {sizeTierShort(detailPkg.sizeTier)} guests
                </h2>

                <div className="kiddush-modal__badges">
                  <span className="kiddush-modal__badge">{categoryTitle(detailPkg.category)}</span>
                  <span className="kiddush-modal__badge">{sizeTierLabel(detailPkg.sizeTier)}</span>
                </div>

                {detailPkg.shortDescription && (
                  <p className="kiddush-modal__description">
                    {cleanDisplayText(detailPkg.shortDescription)}
                  </p>
                )}

                <div className="kiddush-modal__builder">
                  <div className="kiddush-modal__builder-header">
                    <h3 className="kiddush-modal__builder-title">Build your package</h3>
                    <span className="kiddush-modal__builder-count">
                      {detailBuilderRows.length} item{detailBuilderRows.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {detailBuilderRows.length > 0 ? (
                    <div className="kiddush-modal__options">
                      {detailBuilderRows.map((row) => {
                        const configured = isItemConfigured(row.item, configuredItems);
                        return (
                          <div key={row.key} className="kiddush-modal__option">
                            <div className="kiddush-modal__option-text">
                              {row.section && (
                                <span className="kiddush-modal__option-section">{row.section}</span>
                              )}
                              <span className="kiddush-modal__option-name">{row.name}</span>
                              {row.subtitle && (
                                <span className="kiddush-modal__option-desc">{row.subtitle}</span>
                              )}
                              {row.typeLabel && (
                                <span className="kiddush-modal__option-type">{row.typeLabel}</span>
                              )}
                            </div>
                            {row.requiresConfiguration ? (
                              <button
                                type="button"
                                className={`kiddush-modal__option-action ${configured ? 'is-complete' : ''}`}
                                onClick={() => setConfiguringItem(row.item)}
                              >
                                {getCustomizeActionLabel(row.item, configured)}
                              </button>
                            ) : (
                              <span className="kiddush-modal__option-tag">Included</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="kiddush-modal__builder-empty">
                      Menu details for this package will be posted soon.
                    </p>
                  )}
                  {hasConfigurableItems && !allConfigurableItemsConfigured && (
                    <p className="kiddush-modal__builder-hint">
                      Choose an option for each variable item and customize each configurable item before adding the package to cart.
                    </p>
                  )}
                </div>

                <div className="kiddush-modal__price-row">
                  <span className="kiddush-modal__price-label">Price</span>
                  <span className="kiddush-modal__price-value">${detailUnitPrice.toFixed(2)}</span>
                </div>

                <div className="kiddush-modal__quantity">
                  <span className="kiddush-modal__quantity-label">Quantity</span>
                  <div className="kiddush-modal__quantity-controls">
                    <button
                      type="button"
                      className="kiddush-modal__quantity-btn"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1 || isAdded}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="kiddush-modal__quantity-display">{quantity}</span>
                    <button
                      type="button"
                      className="kiddush-modal__quantity-btn"
                      onClick={() => handleQuantityChange(1)}
                      disabled={isAdded}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="kiddush-modal__total">
                  <span className="kiddush-modal__total-label">Total</span>
                  <span className="kiddush-modal__total-value">${detailTotalPrice}</span>
                </div>

                <button
                  type="button"
                  className={`kiddush-modal__add-btn ${isAdded ? 'is-added' : ''}`}
                  onClick={handleAddToCart}
                  disabled={isAdded || !canAddPackageToCart}
                >
                  {isAdded
                    ? 'Added!'
                    : !canAddPackageToCart
                      ? 'Complete item selections to continue'
                      : `Add to Cart - $${detailTotalPrice}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {configuringItem && (
          <MenuItemModal
            item={normalizeMenuItemForModal(configuringItem)}
            restaurant={kiddushRestaurant}
            isOpen={!!configuringItem}
            onClose={() => setConfiguringItem(null)}
            onAdd={handleConfiguredMenuItem}
          />
        )}

        <section className="kiddush-info" aria-labelledby="kiddush-how-heading">
          <h3 id="kiddush-how-heading">How it works</h3>
          <ol className="kiddush-info__steps">
            {pageCopy.howItWorks.map((step, index) => (
              <li key={step} className="kiddush-info__step">
                <span className="kiddush-info__step-num" aria-hidden="true">{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <Footer />
    </div>
  );
}
