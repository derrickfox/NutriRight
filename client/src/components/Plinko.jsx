import { useState, useEffect, useRef } from 'react';

// ── Board constants (must match server/plinkoGame.js) ─────────────────────────
const ROWS = 8;
const SLOTS = 9;

// ── SVG layout ────────────────────────────────────────────────────────────────
const SVG_W = 450;
const SVG_H = 530;
const COL_W   = SVG_W / SLOTS;   // 50
const ROW_SPACING = 40;
const PEG_Y0  = 110;              // y of first peg row
const DROP_Y  = 52;               // y of drop-zone indicators
const SLOT_Y  = PEG_Y0 + ROWS * ROW_SPACING + 12;
const SLOT_H  = 55;
const CHIP_R  = 13;

// ── Physics ───────────────────────────────────────────────────────────────────
// 9 segment durations (ms).  Segments map to path indices:
//   seg 0 : drop-zone  → peg row 0    (fast initial drop)
//   seg 1 : peg row 0  → peg row 1 }
//       …                           }  gravity-accelerated
//   seg 7 : peg row 6  → peg row 7 }
//   seg 8 : peg row 7  → prize slot  (slower settle)
const SEG_MS = [210, 300, 258, 222, 190, 163, 140, 120, 440];

// Cumulative start time for each segment, plus the total duration at index 9
const SEG_START = (() => {
  const a = [0];
  SEG_MS.forEach((d, i) => a.push(a[i] + d));
  return a;   // [0, 210, 510, 768, 990, 1180, 1343, 1483, 1603, 2043]
})();
const TOTAL_MS = SEG_START[SEG_MS.length];

// Upward micro-bounce (px) injected at the start of each peg-impact segment.
// Segs 0 and 8 are not peg impacts.
const SEG_BOUNCE = [0, 14, 12, 10, 8, 7, 5, 4, 0];

// ── Helpers ───────────────────────────────────────────────────────────────────
function colX(col) { return col * COL_W + COL_W / 2; }

function slotColor(val) {
  if (val >= 5000) return '#FFD700';
  if (val >= 2000) return '#FF8C00';
  if (val >= 1000) return '#FF1E8C';
  if (val >= 500)  return '#00BCD4';
  return '#7C3AED';
}

function formatVal(v) {
  return v >= 1000 ? `${v / 1000}K` : String(v);
}

// Build 10 waypoints from the 9-element chip path.
//   wp[0]   = drop zone
//   wp[1–8] = at each peg-row level  (path[1..8])
//   wp[9]   = inside the prize slot  (same x as wp[8])
function buildWaypoints(path) {
  const pts = [{ x: colX(path[0]), y: DROP_Y }];
  for (let i = 1; i <= ROWS; i++) {
    pts.push({ x: colX(path[i]), y: PEG_Y0 + (i - 1) * ROW_SPACING });
  }
  pts.push({ x: colX(path[ROWS]), y: SLOT_Y + SLOT_H / 2 });
  return pts;   // 10 points, 9 segments
}

// Compute chip render state at `elapsed` ms into the animation.
function sampleChip(elapsed, waypoints) {
  if (elapsed >= TOTAL_MS) {
    const last = waypoints[waypoints.length - 1];
    return { x: last.x, y: last.y, scaleX: 1, scaleY: 1, landed: true };
  }

  // Locate current segment
  let seg = SEG_MS.length - 1;
  for (let i = 0; i < SEG_MS.length; i++) {
    if (elapsed < SEG_START[i + 1]) { seg = i; break; }
  }

  const t = (elapsed - SEG_START[seg]) / SEG_MS[seg]; // 0 → 1 within segment
  const wp0 = waypoints[seg];
  const wp1 = waypoints[seg + 1];

  // ── X : linear ──────────────────────────────────────────────────────────────
  const x = wp0.x + (wp1.x - wp0.x) * t;

  // ── Y : ease-in (gravity) everywhere except the landing segment ─────────────
  const isLanding = seg === SEG_MS.length - 1;
  const ty = isLanding
    ? 1 - (1 - t) ** 2            // ease-out: chip decelerates into the slot
    : t * t;                       // ease-in:  gravity pulls it faster each row
  let y = wp0.y + (wp1.y - wp0.y) * ty;

  // ── Micro-bounce : brief upward blip after each peg deflection ──────────────
  const bh = SEG_BOUNCE[seg];
  if (bh > 0) {
    // Bell-shaped lift that peaks around t≈0.15 and fades by t≈0.5
    const bumpT = Math.min(t / 0.50, 1);
    y -= bh * Math.sin(Math.PI * bumpT) * (1 - bumpT * 0.4);
  }

  // ── Scale : squish deformation on peg impact (segs 1–7, first 30%) ─────────
  let scaleX = 1;
  let scaleY = 1;
  const isPegSeg = seg >= 1 && seg <= SEG_MS.length - 2;
  if (isPegSeg && t < 0.30) {
    const s      = t / 0.30;
    const squish = Math.sin(Math.PI * s);   // 0 → peak → 0 bell
    scaleX = 1 + 0.45 * squish;
    scaleY = 1 - 0.32 * squish;
  }

  // ── Landing settle : slight flatten as chip drops into slot ─────────────────
  if (isLanding && t > 0.70) {
    const s      = (t - 0.70) / 0.30;
    const squish = 4 * s * (1 - s);         // bell, peaks at s=0.5
    scaleX = 1 + 0.28 * squish;
    scaleY = 1 - 0.20 * squish;
  }

  return { x, y, scaleX, scaleY, landed: false };
}

// ── Plinko SVG board ──────────────────────────────────────────────────────────
function Board({
  slotValues,
  droppedChips,
  chipPos,
  chipLanded,
  hoveredCol,
  onHoverCol,
  onDropCol,
  canDrop,
  pegRefsArr,
}) {
  // Pegs: at boundary between each pair of adjacent columns, for each row
  const pegs = [];
  for (let row = 0; row < ROWS; row++) {
    for (let gap = 0; gap < SLOTS - 1; gap++) {
      pegs.push({ x: (gap + 1) * COL_W, y: PEG_Y0 + row * ROW_SPACING });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="plinko-svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id="peg-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="chip-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="slot-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="chip-grad" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#fff"     stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FF8C00" />
        </radialGradient>
        <radialGradient id="chip-land-grad" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#fff"     stopOpacity="0.98" />
          <stop offset="50%"  stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FF1E8C" />
        </radialGradient>
      </defs>

      {/* Board background */}
      <rect x="1" y="1" width={SVG_W - 2} height={SVG_H - 2} rx="14"
        fill="rgba(8,0,28,0.82)" stroke="rgba(167,139,250,0.25)" strokeWidth="1.5" />

      {/* Left + right wall guides */}
      <line x1={COL_W / 2} y1={DROP_Y + 16} x2={COL_W / 2} y2={SLOT_Y}
        stroke="rgba(167,139,250,0.15)" strokeWidth="1" strokeDasharray="4 6" />
      <line x1={SVG_W - COL_W / 2} y1={DROP_Y + 16} x2={SVG_W - COL_W / 2} y2={SLOT_Y}
        stroke="rgba(167,139,250,0.15)" strokeWidth="1" strokeDasharray="4 6" />

      {/* ── Drop zones (top) ── */}
      {Array.from({ length: SLOTS }, (_, i) => {
        const isHovered = hoveredCol === i;
        return (
          <g
            key={i}
            onClick={() => canDrop && onDropCol(i)}
            onMouseEnter={() => canDrop && onHoverCol(i)}
            onMouseLeave={() => canDrop && onHoverCol(null)}
            style={{ cursor: canDrop ? 'pointer' : 'default' }}
          >
            <rect
              x={i * COL_W + 4} y={8}
              width={COL_W - 8} height={32}
              rx="7"
              fill={isHovered ? 'rgba(255,215,0,0.22)' : 'rgba(255,255,255,0.04)'}
              stroke={isHovered ? '#FFD700' : 'rgba(167,139,250,0.2)'}
              strokeWidth={isHovered ? 2 : 1}
            />
            <text
              x={colX(i)} y={29}
              textAnchor="middle"
              fill={isHovered ? '#FFD700' : 'rgba(255,255,255,0.25)'}
              fontSize="13"
              fontWeight="bold"
            >
              ▼
            </text>
          </g>
        );
      })}

      {/* ── Pegs ── */}
      {pegs.map(({ x, y }, i) => (
        <circle
          key={i}
          ref={el => { pegRefsArr.current[i] = el; }}
          cx={x} cy={y} r="5"
          fill="#a78bfa"
          filter="url(#peg-glow)"
          opacity="0.88"
          style={{ transition: 'fill 0.15s, r 0.15s' }}
        />
      ))}

      {/* ── Prize slots (bottom) ── */}
      {slotValues.map((val, i) => {
        const color    = slotColor(val);
        const landCount = droppedChips.filter(c => c.landingSlot === i).length;
        return (
          <g key={i}>
            <rect
              x={i * COL_W + 2} y={SLOT_Y}
              width={COL_W - 4} height={SLOT_H}
              rx="7"
              fill={landCount > 0 ? `${color}44` : `${color}18`}
              stroke={color}
              strokeWidth={landCount > 0 ? 2.5 : 1.5}
              filter={landCount > 0 ? 'url(#slot-glow)' : undefined}
            />
            <text
              x={colX(i)} y={SLOT_Y + SLOT_H / 2 + 6}
              textAnchor="middle"
              fill={color}
              fontSize="12"
              fontWeight="bold"
              fontFamily="'Bangers', cursive"
              letterSpacing="0.5"
            >
              {formatVal(val)}
            </text>
            {landCount > 0 && Array.from({ length: landCount }, (_, k) => (
              <circle
                key={k}
                cx={colX(i) + (k - (landCount - 1) / 2) * 10}
                cy={SLOT_Y - 8}
                r="5"
                fill={color}
                opacity="0.75"
              />
            ))}
          </g>
        );
      })}

      {/* ── Animated chip ── */}
      {chipPos && (
        <g
          transform={`translate(${chipPos.x}, ${chipPos.y}) scale(${chipPos.scaleX}, ${chipPos.scaleY})`}
          filter="url(#chip-glow)"
        >
          <circle
            cx={0} cy={0} r={CHIP_R}
            fill={chipLanded ? 'url(#chip-land-grad)' : 'url(#chip-grad)'}
          />
          {chipLanded && (
            <circle cx={0} cy={0} r={CHIP_R + 4} fill="none"
              stroke="#FFD700" strokeWidth="2" opacity="0.6"
              className="chip-land-ring"
            />
          )}
        </g>
      )}
    </svg>
  );
}

// ── Main Plinko component ─────────────────────────────────────────────────────
export default function Plinko({
  startData,
  currentChip,
  complete,
  hasContinued,
  localPlayerId,
  onDrop,
  onContinue,
}) {
  const isWinner = localPlayerId === startData.winnerId;

  const [chipPos,    setChipPos]    = useState(null);
  const [chipLanded, setChipLanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredCol,  setHoveredCol]  = useState(null);
  const [droppedChips, setDroppedChips] = useState([]);
  const [lastPoints,   setLastPoints]   = useState(null);
  const [totalPoints,  setTotalPoints]  = useState(0);
  const [chipsLeft,    setChipsLeft]    = useState(startData.totalChips);

  // RAF handle and per-animation state stored in refs (no re-renders)
  const rafRef          = useRef(null);
  const startTimeRef    = useRef(null);
  const waypointsRef    = useRef(null);
  const pegRefsArr      = useRef([]);       // populated by Board via ref callbacks
  const lastFlashedSeg  = useRef(-1);       // prevents double-flashing same peg

  // ── Physics animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentChip) return;

    // Cancel any in-progress animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const waypoints = buildWaypoints(currentChip.path);
    waypointsRef.current = waypoints;
    lastFlashedSeg.current = -1;

    setChipLanded(false);
    setIsAnimating(true);
    // Snap chip to starting position immediately so it's visible before physics starts
    setChipPos({ x: waypoints[0].x, y: waypoints[0].y, scaleX: 1, scaleY: 1 });

    function frame(now) {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;

      // ── Peg flash via direct DOM manipulation (avoids React re-renders) ─────
      // Find which segment we're in to detect the moment of peg impact
      let seg = SEG_MS.length - 1;
      for (let i = 0; i < SEG_MS.length; i++) {
        if (elapsed < SEG_START[i + 1]) { seg = i; break; }
      }
      const t = (elapsed - SEG_START[seg]) / SEG_MS[seg];

      if (seg >= 1 && seg <= 7 && t < 0.12 && seg !== lastFlashedSeg.current) {
        lastFlashedSeg.current = seg;
        const pegRow = seg - 1;
        const pegGap = Math.min(
          currentChip.path[seg - 1],
          currentChip.path[seg],
        );
        const pegIndex = pegRow * (SLOTS - 1) + pegGap;
        const el = pegRefsArr.current[pegIndex];
        if (el) {
          el.setAttribute('fill', '#ffffff');
          el.setAttribute('r', '7');
          el.setAttribute('opacity', '1');
          setTimeout(() => {
            if (el) {
              el.setAttribute('fill', '#a78bfa');
              el.setAttribute('r', '5');
              el.setAttribute('opacity', '0.88');
            }
          }, 220);
        }
      }

      // ── Sample physics position ──────────────────────────────────────────
      const pos = sampleChip(elapsed, waypoints);
      setChipPos(pos);

      if (pos.landed) {
        // Animation complete — update score display and chip indicators
        setChipLanded(true);
        setIsAnimating(false);
        setDroppedChips(prev => [...prev, currentChip]);
        setLastPoints(currentChip.points);
        setTotalPoints(currentChip.totalPoints);
        setChipsLeft(currentChip.chipsRemaining);
        startTimeRef.current = null;
        return; // don't schedule next frame
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    startTimeRef.current = null;
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startTimeRef.current = null;
    };
    // chipsRemaining decrements uniquely per drop (2→1→0), fires exactly once per chip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChip?.chipsRemaining]);

  function handleDropCol(col) {
    if (isAnimating || !isWinner) return;
    setHoveredCol(null);
    onDrop(col);
  }

  const { slotValues } = startData;

  const chipIndicators = Array.from({ length: startData.totalChips }, (_, i) => {
    const dropped = startData.totalChips - chipsLeft;
    return i < dropped ? 'used' : 'ready';
  });

  return (
    <div className="plinko-screen">

      {/* ── Header banner ── */}
      <div className="show-stage-header">
        <div className="show-banner plinko-banner">
          <span className="show-round-title">🎰 PLINKO! 🎰</span>
        </div>
      </div>

      {/* ── Subtitle ── */}
      <p className="plinko-subtitle">
        {isWinner
          ? '🏆 You won! Drop your chips — aim for the centre!'
          : `👀 Watch ${startData.winnerUsername} play Plinko!`}
      </p>

      <div className="plinko-body">

        {/* ── Board ── */}
        <div className="plinko-board-wrap">
          <Board
            slotValues={slotValues}
            droppedChips={droppedChips}
            chipPos={chipPos}
            chipLanded={chipLanded}
            hoveredCol={hoveredCol}
            onHoverCol={setHoveredCol}
            onDropCol={handleDropCol}
            canDrop={isWinner && !isAnimating && !complete && chipsLeft > 0}
            pegRefsArr={pegRefsArr}
          />
        </div>

        {/* ── Side panel ── */}
        <div className="plinko-panel">

          {/* Chip indicators */}
          <div className="plinko-chips-row">
            {chipIndicators.map((state, i) => (
              <div key={i} className={`plinko-chip-dot ${state}`} />
            ))}
          </div>
          <p className="plinko-chips-label">
            {chipsLeft > 0
              ? `${chipsLeft} chip${chipsLeft !== 1 ? 's' : ''} left`
              : 'All chips dropped!'}
          </p>

          {/* Running score */}
          {lastPoints !== null && (
            <div className="plinko-last-points">
              <span className="plinko-last-label">Last chip</span>
              <span className="plinko-last-value" style={{ color: slotColor(lastPoints) }}>
                +{lastPoints.toLocaleString()}
              </span>
            </div>
          )}
          {totalPoints > 0 && (
            <div className="plinko-total-points">
              <span className="plinko-total-label">Total bonus</span>
              <span className="plinko-total-value">{totalPoints.toLocaleString()} pts</span>
            </div>
          )}

          {/* Instructions / controls */}
          {!complete && (
            <>
              {isWinner && !isAnimating && chipsLeft > 0 && (
                <div className="plinko-aim-hint">
                  <p>Hover a column above ▲</p>
                  <p>then click to drop!</p>
                </div>
              )}
              {isAnimating && (
                <div className="plinko-dropping-msg">
                  <div className="waiting-dots"><span /><span /><span /></div>
                  <p>Dropping…</p>
                </div>
              )}
              {!isWinner && (
                <div className="plinko-spectator-msg">
                  Watching <strong>{startData.winnerUsername}</strong> play…
                </div>
              )}
            </>
          )}

          {/* Complete screen */}
          {complete && (
            <div className="plinko-complete">
              <div className="plinko-complete-icon">🎊</div>
              <h3 className="plinko-complete-title gold">
                {complete.winnerUsername} won
              </h3>
              <div className="plinko-complete-score">
                {complete.totalPoints.toLocaleString()}
                <span className="plinko-complete-pts">bonus pts!</span>
              </div>
              {!hasContinued ? (
                <button className="btn btn-primary btn-lg plinko-continue-btn" onClick={onContinue}>
                  Back to the Show →
                </button>
              ) : (
                <div className="waiting-msg" style={{ marginTop: '1rem' }}>
                  <div className="waiting-dots"><span /><span /><span /></div>
                  <p className="muted">Waiting for everyone…</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
