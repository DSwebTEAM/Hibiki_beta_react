import { useState, useEffect, useRef, useCallback } from 'react'
import { Memory } from '../../lib/memory'
import { storage } from '../../lib/storage'

// Star Memory Constellation Easter Egg
// Trigger: tap the 響 kanji 6 times in Settings
// Visual: dark space, stars appear one by one, connect into constellations
// Each constellation = a memory category

const CAT_COLORS = {
  preference:   '#f9c0cb',
  emotion:      '#a0b4ff',
  fact:         '#a0ffb4',
  relationship: '#ffcfa0',
  event:        '#d0a0ff',
}

const CAT_NAMES = {
  preference:   '好み',
  emotion:      '感情',
  fact:         '事実',
  relationship: '絆',
  event:        '出来事',
}

function drawConstellation(canvas, stars, connections, frame) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)

  // Draw background nebula glow
  const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.6)
  grad.addColorStop(0,   'rgba(80,20,60,0.18)')
  grad.addColorStop(0.5, 'rgba(30,10,40,0.12)')
  grad.addColorStop(1,   'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Draw connections (lines between stars in same category)
  connections.forEach(({ from, to, opacity }) => {
    if (!stars[from] || !stars[to]) return
    const sf = stars[from], st = stars[to]
    if (!sf.visible || !st.visible) return
    ctx.beginPath()
    ctx.moveTo(sf.x, sf.y)
    ctx.lineTo(st.x, st.y)
    ctx.strokeStyle = `rgba(${hexToRgb(sf.color)}, ${opacity * 0.3})`
    ctx.lineWidth = 0.8
    ctx.stroke()
  })

  // Draw stars
  stars.forEach((star, i) => {
    if (!star.visible) return
    const pulse = 0.85 + Math.sin(frame * 0.03 + i * 0.7) * 0.15
    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 3.5)
    glow.addColorStop(0,   `rgba(${hexToRgb(star.color)}, ${star.opacity * pulse})`)
    glow.addColorStop(0.4, `rgba(${hexToRgb(star.color)}, ${star.opacity * pulse * 0.4})`)
    glow.addColorStop(1,   'transparent')
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size * 3.5, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    // Core
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size * pulse, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${hexToRgb(star.color)}, ${star.opacity})`
    ctx.fill()

    // Label
    if (star.label && star.opacity > 0.6) {
      ctx.font = `${11 + star.size}px serif`
      ctx.fillStyle = `rgba(${hexToRgb(star.color)}, ${star.opacity * 0.7})`
      ctx.textAlign = 'center'
      ctx.fillText(star.label, star.x, star.y - star.size * 2 - 5)
    }
  })
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `${r},${g},${b}`
}

function buildStarsFromMemories(W, H) {
  // Collect all memories across all chats
  const chats = storage.getChats()
  const allMems = []
  chats.forEach(c => {
    Memory.getAll(c.id).forEach(m => allMems.push({ ...m, charName: c.charName }))
  })

  if (!allMems.length) {
    // Empty state — show 5 placeholder stars
    return {
      stars: Array.from({ length: 5 }, (_, i) => ({
        x: W * 0.2 + (W * 0.6 * i / 4),
        y: H * 0.4 + Math.sin(i * 1.2) * H * 0.15,
        size: 2.5, color: '#f9c0cb', opacity: 0, visible: false,
        label: null,
      })),
      connections: [],
    }
  }

  // Group by category, max 5 per category, max 20 total
  const grouped = {}
  allMems.slice(0, 25).forEach(m => {
    if (!grouped[m.category]) grouped[m.category] = []
    if (grouped[m.category].length < 5) grouped[m.category].push(m)
  })

  const stars = []
  const connections = []
  const cats = Object.keys(grouped)
  const centerX = W / 2, centerY = H / 2

  cats.forEach((cat, ci) => {
    const mems = grouped[cat]
    const angle = (ci / cats.length) * Math.PI * 2 - Math.PI / 2
    const clusterR = Math.min(W, H) * 0.28
    const cx = centerX + Math.cos(angle) * clusterR
    const cy = centerY + Math.sin(angle) * clusterR
    const color = CAT_COLORS[cat] || '#ffffff'

    // Category anchor star
    const anchorIdx = stars.length
    stars.push({
      x: cx, y: cy, size: 4.5, color, opacity: 0, visible: false,
      label: CAT_NAMES[cat] || cat,
    })

    mems.forEach((mem, mi) => {
      const spread = 60 + mi * 18
      const a2 = angle + (mi - mems.length / 2) * 0.45
      const sx = cx + Math.cos(a2) * spread + (Math.random() - 0.5) * 20
      const sy = cy + Math.sin(a2) * spread + (Math.random() - 0.5) * 20
      const memIdx = stars.length
      stars.push({
        x: Math.max(30, Math.min(W - 30, sx)),
        y: Math.max(30, Math.min(H - 30, sy)),
        size: 2 + Math.random() * 1.5,
        color,
        opacity: 0,
        visible: false,
        label: mem.content.split(' ').slice(0, 3).join(' ') + '…',
      })
      connections.push({ from: anchorIdx, to: memIdx, opacity: 0.6 })
      if (mi > 0) connections.push({ from: memIdx - 1, to: memIdx, opacity: 0.3 })
    })

    // Cross-constellation faint lines between anchors
    if (ci > 0) connections.push({ from: 0, to: anchorIdx, opacity: 0.08 })
  })

  return { stars, connections }
}

export function ConstellationEasterEgg({ onClose }) {
  const canvasRef = useRef(null)
  const frameRef  = useRef(0)
  const animRef   = useRef(null)
  const starsRef  = useRef([])
  const connsRef  = useRef([])
  const revealedRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const { stars, connections } = buildStarsFromMemories(canvas.width, canvas.height)
    starsRef.current = stars
    connsRef.current = connections

    // Reveal stars one by one
    let revealed = 0
    const revealInterval = setInterval(() => {
      if (revealed < stars.length) {
        stars[revealed].visible = true
        revealed++
      } else {
        clearInterval(revealInterval)
      }
    }, 160)

    // Animation loop
    const loop = () => {
      starsRef.current.forEach(s => {
        if (s.visible && s.opacity < 1) s.opacity = Math.min(1, s.opacity + 0.04)
      })
      drawConstellation(canvasRef.current, starsRef.current, connsRef.current, frameRef.current)
      frameRef.current++
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)

    const handleResize = () => {
      if (!canvasRef.current) return
      canvasRef.current.width  = window.innerWidth
      canvasRef.current.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(revealInterval)
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div className="constellation-overlay" onClick={onClose}>
      <canvas ref={canvasRef} className="constellation-canvas" />
      <div className="constellation-label">
        星の記憶<br />
        <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', opacity: 0.5 }}>tap anywhere to close</span>
      </div>
      <button className="constellation-close" onClick={onClose}>✕</button>
    </div>
  )
}

// Hook: 6 taps to trigger
export function useConstellationTrigger() {
  const [show, setShow] = useState(false)
  const tapsRef = useRef(0)
  const timerRef = useRef(null)

  const onTap = useCallback(() => {
    tapsRef.current++
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { tapsRef.current = 0 }, 1800)
    if (tapsRef.current >= 6) { tapsRef.current = 0; setShow(true) }
  }, [])

  return { show, setShow, onTap }
}
