import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Building2, ArrowRight } from 'lucide-react';
import './AdminOrdersChooser.scss';

const CHOICES = [
  {
    id: 'customer',
    path: '/admin/orders/customer',
    eyebrow: 'Retail',
    title: 'Customer Orders',
    description: 'Restaurant and delivery orders from the customer site.',
    cta: 'Open customer orders',
    Icon: ShoppingBag
  },
  {
    id: 'nursing-homes',
    path: '/admin/orders/nursing-homes',
    eyebrow: 'Facilities',
    title: 'Nursing Home Orders',
    description: 'Weekly resident meal orders across nursing home facilities.',
    cta: 'Open nursing home orders',
    Icon: Building2
  }
];

const AdminOrdersChooser = () => {
  const navigate = useNavigate();

  return (
    <div className="admin-orders-chooser">
      <header className="admin-orders-chooser__header">
        <h1>Orders</h1>
        <p>Choose which order system to open. Each list loads only its own data.</p>
      </header>

      <div className="admin-orders-chooser__grid" role="list">
        {CHOICES.map(({ id, path, eyebrow, title, description, cta, Icon }) => (
          <button
            key={id}
            type="button"
            className="chooser-card"
            role="listitem"
            onClick={() => navigate(path)}
          >
            <span className="chooser-card__icon" aria-hidden="true">
              <Icon size={28} strokeWidth={1.75} />
            </span>
            <span className="chooser-card__eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="chooser-card__cta">
              {cta}
              <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdminOrdersChooser;
