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
      return '8–12 guests';
    case '15_20':
      return '15–20 guests';
    case '25_plus':
      return '25+ guests';
    default:
      return tier;
  }
};

const categoryTitle = (cat) =>
  cat === 'shalom_zachor' ? 'Shalom Zachor Options' : 'Kiddush Options';

const lineCategoryForPackage = (cat) =>
  cat === 'shalom_zachor' ? 'Shalom Zachor package' : 'Kiddush package';

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
  const [showAdded, setShowAdded] = useState(false);
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

  const kiddushRestaurant = useMemo(
    () => ({
      id: MKD_KIDDUSH_RESTAURANT_ID,
      name: MKD_KIDDUSH_RESTAURANT_NAME,
      logo: navyMKDIcon
    }),
    []
  );

  const handleAddToCart = (pkg) => {
    const desc =
      pkg.shortDescription ||
      `${categoryTitle(pkg.category)} — ${sizeTierLabel(pkg.sizeTier)}`;

    const cartItem = {
      id: pkg.id,
      name: pkg.name,
      price: Number(pkg.price),
      description: desc,
      itemType: 'simple',
      category: lineCategoryForPackage(pkg.category),
      image: pkg.imageUrl ? buildImageUrl(pkg.imageUrl) : navyMKDIcon,
      kiddushPackageId: pkg.id,
      metadata: {
        kiddushPackageId: pkg.id,
        category: pkg.category,
        sizeTier: pkg.sizeTier
      }
    };

    addToCart(cartItem, 1, kiddushRestaurant);
    setShowAdded(true);
    setTimeout(() => setShowAdded(false), 2200);
    setDetailPkg(null);
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
                Shabbat packages sized for your gathering. Add to your cart and
                check out with restaurant orders in one delivery.
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
            <LoadingSpinner size="medium" text="Loading packages…" variant="primary" />
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
                  <span className="kiddush-size-card__tier">{sizeTierLabel(pkg.sizeTier)}</span>
                  <span className="kiddush-size-card__name">{pkg.name}</span>
                  <span className="kiddush-size-card__price">
                    ${Number(pkg.price).toFixed(2)}
                  </span>
                  {pkg.shortDescription && (
                    <span className="kiddush-size-card__hint">{pkg.shortDescription}</span>
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
            onClick={() => setDetailPkg(null)}
          >
            <div className="kiddush-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="kiddush-modal__close"
                aria-label="Close"
                onClick={() => setDetailPkg(null)}
              >
                ×
              </button>
              <h2 id="kiddush-modal-title" className="kiddush-modal__title">
                {detailPkg.name}
              </h2>
              <p className="kiddush-modal__meta">
                {categoryTitle(detailPkg.category)} · {sizeTierLabel(detailPkg.sizeTier)}
              </p>
              <p className="kiddush-modal__price">${Number(detailPkg.price).toFixed(2)}</p>
              {detailPkg.shortDescription && (
                <p className="kiddush-modal__subtitle">{detailPkg.shortDescription}</p>
              )}
              <h3 className="kiddush-modal__includes-heading">Included</h3>
              <ul className="kiddush-modal__list">
                {(detailPkg.includedItems || []).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <div className="kiddush-modal__actions">
                <button
                  type="button"
                  className={`kiddush-add-btn ${showAdded ? 'is-added' : ''}`}
                  onClick={() => handleAddToCart(detailPkg)}
                  disabled={showAdded}
                >
                  {showAdded ? '✓ Added to cart' : 'Add to cart'}
                </button>
              </div>
              <div className="kiddush-modal__footer-links">
                <Link to="/restaurants" onClick={() => setDetailPkg(null)}>
                  Continue shopping
                </Link>
                <Link to="/checkout" onClick={() => setDetailPkg(null)}>
                  Proceed to checkout
                </Link>
              </div>
            </div>
          </div>
        )}

        <section className="kiddush-info">
          <h3>How it works</h3>
          <ul>
            <li>Choose Kiddush or Shalom Zachor, then pick a guest count tier.</li>
            <li>Add packages to your cart alongside meals from our restaurants.</li>
            <li>One checkout. Delivery follows our usual Friday schedule.</li>
          </ul>
        </section>
      </div>
      <Footer />
    </div>
  );
}
