// A friendly placeholder for a list or section with nothing in it yet: an
// icon in a soft circle, one line saying what will appear, and an optional
// next step.
export default function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>
        {icon}
      </span>
      <strong>{title}</strong>
      {children && <p className="small text-2">{children}</p>}
      {action}
    </div>
  )
}

// Grey placeholder rows shown while something loads.
export function SkeletonRows({ count = 4, label = 'Loading' }) {
  return (
    <ul className="clean skeleton-list" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <span className="skeleton" style={{ width: `${62 - (i % 3) * 12}%` }} />
          <span className="skeleton short" />
        </li>
      ))}
    </ul>
  )
}
