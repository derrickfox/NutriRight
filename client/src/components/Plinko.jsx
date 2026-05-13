import { useState, useEffect, useRef } from 'react';

// ── Board constants (must match server/plinkoGame.js) ─────────────────────────
const ROWS = 8;
const SLOTS = 9;

// ── SVG layout ────────────────────────────────────────────────────────────────
const SVG_W = 450;
const SVG_H = 530;
const COL_W = SVG_W / SLOTS; // 50
const ROW_SPACING = 40;
const PEG_Y0 = 110;        // y of first peg row
const DROP_Y = 52;          // y of drop zone circles
const SLOT_Y = PEG_Y0 + ROWS * ROW_SPACING + 12; // y of prize slot tops
const SLOT_H = 55;
const CHIP_R = 13;

const STEP_DELAY_MS = 290;  // time between animation steps

function colX(col) {
  return col * COL_W + COL_W / 2;
}

function getChipY(step) {
  if (step === 0) return DROP_Y;
  if (step >= ROWS) return SLOT_Y + SLOT_H / 2; // landed
  return PEG_Y0 + (step - 1) * ROW_SPACING + ROW_SPACING / 2;
}

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

// ── Plinko SVG board ──────────────────────────────────────────────────────────
function Board({
  slotValues,
  droppedChips,
  currentChip,
  animStep,
  hoveredCol,
  onHoverCol,
  onDropCol,
  canDrop,
}) {
  // Pegs: at boundary between each pair of adjacent columns, for each row
  const pegs = [];
  for (let row = 0; row < ROWS; row++) {
    for (let gap = 0; gap < SLOTS - 1; gap++) {
      pegs.push({ x: (gap + 1) * COL_W, y: PEG_Y0 + row * ROW_SPACING });
    }
  }

  // Chip position
  const chipX = currentChip && animStep !== null ? colX(currentChip.path[Math.min(animStep, ROWS)]) : null;
  const chipY = animStep !== null ? getChipY(animStep) : null;
  const chipLanded = animStep !== null && animStep >= ROWS;

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
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FF8C00" />
        </radialGradient>
        <radialGradient id="chip-land-grad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.98" />
          <stop offset="50%" stopColor="#FFD700" />
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
        <circle key={i} cx={x} cy={y} r="5"
          fill="#a78bfa"
          filter="url(#peg-glow)"
          opacity="0.88"
        />
      ))}

      {/* ── Prize slots (bottom) ── */}
      {slotValues.map((val, i) => {
        const color = slotColor(val);
        // Has a chip landed here?
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
            {/* Landing dot(s) */}
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
      {currentChip && animStep !== null && chipX !== null && (
        <g
          style={{
            transform: `translate(${chipX}px, ${chipY}px)`,
            transition: `transform ${STEP_DELAY_MS}ms cubic-bezier(0.4, 0, 0.6, 1)`,
          }}
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

  const [animStep, setAnimStep] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [droppedChips, setDroppedChips] = useState([]);
  const [lastPoints, setLastPoints] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [chipsLeft, setChipsLeft] = useState(startData.totalChips);

  const timerRefs = useRef([]);

  // Animate chip when a new one arrives from server
  useEffect(() => {
    if (!currentChip) return;

    // Clear any previous timers
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];

    setAnimStep(0);
    setIsAnimating(true);

    // Schedule each step
    for (let step = 1; step <= ROWS; step++) {
      const t = setTimeout(() => {
        setAnimStep(step);
        if (step >= ROWS) {
          // Chip has landed
          setIsAnimating(false);
          setDroppedChips((prev) => [...prev, currentChip]);
          setLastPoints(currentChip.points);
          setTotalPoints(currentChip.totalPoints);
          setChipsLeft(currentChip.chipsRemaining);
        }
      }, step * STEP_DELAY_MS);
      timerRefs.current.push(t);
    }

    return () => timerRefs.current.forEach(clearTimeout);
    // chipsRemaining decrements uniquely per drop (2→1→0), so this fires exactly once per chip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChip?.chipsRemaining]);

  function handleDropCol(col) {
    if (isAnimating || !isWinner) return;
    setHoveredCol(null);
    onDrop(col);
  }

  const { slotValues } = startData;

  // Chip indicators (filled / empty circles)
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
            currentChip={currentChip}
            animStep={animStep}
            hoveredCol={hoveredCol}
            onHoverCol={setHoveredCol}
            onDropCol={handleDropCol}
            canDrop={isWinner && !isAnimating && !complete && chipsLeft > 0}
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
            {chipsLeft > 0 ? `${chipsLeft} chip${chipsLeft !== 1 ? 's' : ''} left` : 'All chips dropped!'}
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
