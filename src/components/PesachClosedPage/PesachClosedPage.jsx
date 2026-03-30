import './PesachClosedPage.scss';

export default function PesachClosedPage() {
  return (
    <div className="pesach-closed-page">
      <div className="pesach-closed-card">
        <div className="pesach-closed-icon" aria-hidden="true">🍷</div>
        <h1 className="pesach-closed-title">Closed for Pesach!</h1>
        <p className="pesach-closed-message">We will reopen post-Chag</p>
        <p className="pesach-closed-sub">Wishing you a Chag Kasher V'Sameach</p>
      </div>
    </div>
  );
}
