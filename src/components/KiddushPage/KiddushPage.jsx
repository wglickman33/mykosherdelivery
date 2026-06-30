import './KiddushPage.scss';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

const cleanDisplayText = (text) => {
  if (!text) return '';
  return String(text).replace(/\u2014/g, ', ').replace(/\u2013/g, '-');
};

const isPlaceholderLine = (line) =>
  typeof line === 'string' && /placeholder/i.test(line);

const getIncludedItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((line) => cleanDisplayText(line).trim())
    .filter((line) => line && !isPlaceholderLine(line));
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
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('kiddush');
  const [detailPkg, setDetailPkg] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
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

  const detailIncludedItems = useMemo(
    () => (detailPkg ? getIncludedItems(detailPkg.includedItems) : []),
    [detailPkg]
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
    }
  }, [detailPkg]);

  const detailUnitPrice = detailPkg ? Number(detailPkg.price) : 0;
  const detailTotalPrice = (detailUnitPrice * quantity).toFixed(2);

  const closeDetail = () => {
    if (isAdded) return;
    setDetailPkg(null);
    setQuantity(1);
  };

  const handleQuantityChange = (change) => {
    setQuantity((prev) => Math.max(1, prev + change));
  };

  const handleAddToCart = () => {
    if (!detailPkg || isAdded) return;

    const desc =
      detailPkg.shortDescription ||
      `${categoryTitle(detailPkg.category)}, ${sizeTierLabel(detailPkg.sizeTier)}`;

    const cartItem = {
      id: detailPkg.id,
      name: cleanDisplayText(detailPkg.name),
      price: detailUnitPrice,
      description: cleanDisplayText(desc),
      itemType: 'simple',
      category: lineCategoryForPackage(detailPkg.category),
      image: detailPkg.imageUrl ? buildImageUrl(detailPkg.imageUrl) : navyMKDIcon,
      kiddushPackageId: detailPkg.id,
      metadata: {
        kiddushPackageId: detailPkg.id,
        category: detailPkg.category,
        sizeTier: detailPkg.sizeTier
      }
    };

    addToCart(cartItem, quantity, kiddushRestaurant);
    setIsAdded(true);

    setTimeout(() => {
      setIsAdded(false);
      setDetailPkg(null);
      setQuantity(1);
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
              <h1 className="kiddush-title">Kiddush &amp; Shalom Zachor</h1>
              <p className="kiddush-subtitle">
                Configure a package for your Shabbat gathering. Choose Kiddush or
                Shalom Zachor, pick a guest count, review what&apos;s included, and
                add it to your cart alongside restaurant orders for one checkout
                and delivery.
              </p>
            </div>
          </div>
        </div>

        <section className="kiddush-category-tabs" aria-label="Package type">
          <button
            type="button"
            className={`kiddush-tab ${category === 'kiddush' ? 'is-active' : ''}`}
            onClick={() => setCategory('kiddush')}
          >
            Kiddush Options
          </button>
          <button
            type="button"
            className={`kiddush-tab ${category === 'shalom_zachor' ? 'is-active' : ''}`}
            onClick={() => setCategory('shalom_zachor')}
          >
            Shalom Zachor Options
          </button>
        </section>

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
                  {pkg.shortDescription && (
                    <span className="kiddush-size-card__hint">
                      {cleanDisplayText(pkg.shortDescription)}
                    </span>
                  )}
                  <span className="kiddush-size-card__cta">View details</span>
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
                    <h3 className="kiddush-modal__builder-title">What&apos;s included</h3>
                    <span className="kiddush-modal__builder-count">
                      {detailIncludedItems.length} item{detailIncludedItems.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {detailIncludedItems.length > 0 ? (
                    <div className="kiddush-modal__options">
                      {detailIncludedItems.map((line, i) => (
                        <div key={i} className="kiddush-modal__option">
                          <span className="kiddush-modal__option-name">{line}</span>
                          <span className="kiddush-modal__option-tag">Included</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="kiddush-modal__builder-empty">
                      Menu details for this package will be posted soon.
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
                  disabled={isAdded}
                >
                  {isAdded ? 'Added!' : `Add to Cart - $${detailTotalPrice}`}
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="kiddush-info" aria-labelledby="kiddush-how-heading">
          <h3 id="kiddush-how-heading">How it works</h3>
          <ol className="kiddush-info__steps">
            <li className="kiddush-info__step">
              <span className="kiddush-info__step-num" aria-hidden="true">1</span>
              <p>Choose Kiddush or Shalom Zachor, then pick a guest count tier.</p>
            </li>
            <li className="kiddush-info__step">
              <span className="kiddush-info__step-num" aria-hidden="true">2</span>
              <p>Add packages to your cart alongside meals from our restaurants.</p>
            </li>
            <li className="kiddush-info__step">
              <span className="kiddush-info__step-num" aria-hidden="true">3</span>
              <p>One checkout. Delivery follows our usual Friday schedule.</p>
            </li>
          </ol>
        </section>
      </div>
      <Footer />
    </div>
  );
}
