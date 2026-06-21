export default function PanelSection({ title, subtitle, children, className = "" }) {
  return (
    <div className={className}>
      {(title || subtitle) && (
        <div className="pgoc-section-header">
          {title && <span className="pgoc-section-title">{title}</span>}
          {subtitle && <span className="pgoc-section-sub">{subtitle}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
