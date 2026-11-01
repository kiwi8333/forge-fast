import { useRef, useState } from 'react'

const START_PX = 10
const OUT_MS = 180
// A quick flick deletes even if it is short.
const FLICK_PX_PER_MS = 0.6
const FLICK_MIN_PX = 48

/**
 * A row you can swipe left to delete. Vertical scrolling is left to the
 * browser; a drag only counts once it is clearly sideways. Past the
 * threshold the row slides away and onDelete runs; otherwise it springs
 * back. Rows should also keep a visible delete button for people who don't
 * swipe (and for keyboards and screen readers).
 */
export default function SwipeRow({ as: Tag = 'li', onDelete, disabled = false, className = '', children }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  // The live offset: pointer events can arrive faster than React re-renders,
  // so the release must not read a stale `dx`.
  const offset = useRef(0)
  const drag = useRef(null)
  const moved = useRef(false)
  const root = useRef(null)

  function down(e) {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, active: false, id: e.pointerId }
    moved.current = false
  }

  function move(e) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const ddx = e.clientX - d.x
    const ddy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(ddy) > START_PX && Math.abs(ddy) > Math.abs(ddx)) {
        drag.current = null // the user is scrolling
        return
      }
      if (ddx < -START_PX && Math.abs(ddx) > Math.abs(ddy) * 1.3) {
        d.active = true
        moved.current = true
        setDragging(true)
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } else return
    }
    offset.current = Math.min(0, ddx)
    setDx(offset.current)
  }

  function up(e) {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    setDragging(false)
    const width = root.current?.offsetWidth ?? 320
    const moved = offset.current
    offset.current = 0
    const speed = -moved / Math.max(1, e.timeStamp - d.t)
    if (moved < -Math.min(120, width * 0.35) || (moved < -FLICK_MIN_PX && speed > FLICK_PX_PER_MS)) {
      setDx(-width)
      setTimeout(() => {
        onDelete()
        setDx(0)
      }, OUT_MS)
    } else {
      setDx(0)
    }
  }

  return (
    <Tag ref={root} className={`swipe ${dx < 0 ? 'swiping' : ''}`}>
      <div className="swipe-bg" aria-hidden>
        <span style={{ opacity: Math.min(1, -dx / 80) }}>Delete</span>
      </div>
      <div
        className={`swipe-fg ${className}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? 'none' : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          // A swipe that ends over a button must not also press it.
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
          }
        }}
      >
        {children}
      </div>
    </Tag>
  )
}
