export default function SidebarPanel({ icon, title, children, className = "" }) {
  return (
    <div className={`hud-panel ${className}`.trim()}>
      {(icon || title) && (
        <div className="hud-panel-header">
          {icon && <span className="hud-panel-icon">{icon}</span>}
          {title && <span className="hud-panel-title pgoc-section-title">{title}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
