const PORTAL_URL = "https://ji-portal-operacional.onrender.com/";

export function PortalBackLink() {
  return (
    <a
      className="ji-portal-back"
      href={PORTAL_URL}
      aria-label="Voltar ao Portal JI"
      title="Voltar ao Portal JI"
    >
      <span className="ji-portal-back__arrow" aria-hidden="true">←</span>
      <span className="ji-portal-back__label">Portal JI</span>
    </a>
  );
}
