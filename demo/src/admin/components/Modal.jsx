import './Modal.css'

export default function Modal({ title, open, onClose, children, footer }) {
  if (!open) return null
  return (
    <div className="m-backdrop" onMouseDown={onClose}>
      <div className="m-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="m-head">
          <div className="m-title">{title}</div>
          <button className="m-x" onClick={onClose}>✕</button>
        </div>
        <div className="m-body">{children}</div>
        {footer ? <div className="m-foot">{footer}</div> : null}
      </div>
    </div>
  )
}
