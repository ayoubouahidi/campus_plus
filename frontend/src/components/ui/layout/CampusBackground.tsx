import type { CSSProperties } from 'react';
import styles from './CampusBackground.module.css';

/**
 * CampusBackground: the site-wide backdrop. "Desert elevation at golden hour, drawn by an engineer."
 *  - Horizon (bottom): a hairline elevation of the campus. A long terracotta block with stepped, recessed
 *    portals and claustra perforation grids (UM6P / Bofill), a tree-column solar pergola, and a slotted tower
 *    with a lattice strip.
 *  - Sky (top corners, from 640px): 1337-style circuit traces and a small constellation, ending in nodes and one
 *    coordinate tag (Benguerir).
 *  - Field: a 42° rhombic micro-lattice that only lives at the edges.
 *
 * Readability contract: art only at the edges; the content zone is masked and veiled; line art stays at
 * ~16% (light) / ~20% (dark) opacity times `intensity`. Cards, navbar, tab bar and footer sit on top.
 * Purely decorative and static (no animation): aria-hidden, no pointer events, hidden in print and
 * forced-colors mode. No hooks and no client JS: a Server Component.
 *
 * Render it ONCE (root layout): SVG pattern ids are document-global.
 */

export type CampusBackgroundTheme = 'system' | 'light' | 'dark';

export interface CampusBackgroundProps {
  // 'system' (default) follows the OS, like every dark: style in this app. 'light' / 'dark' force a mode.
  theme?: CampusBackgroundTheme;
  // Multiplier on all line-art opacity: 0 hides the art, 1 is the tuned default, clamped to 1.5.
  intensity?: number;
  className?: string;
}

/* ------------------------------------------------------------------------- */
/* Geometry (horizon viewBox: 0 520 1600 480)                                 */
/* ------------------------------------------------------------------------- */

const GROUND = 968;
const FACADE_X0 = 186;
const FACADE_TOP = 792;
const PORTALS = [300, 545, 790, 1035, 1280, 1525]; // portal centre lines
const COLUMNS = [1180, 1330, 1480]; // pergola tree-columns
const PERF = 16; // claustra module

const round1 = (n: number) => Math.round(n * 10) / 10;

// Pergola canopy: a sloped plane seen from the plaza.
const frontTop = (x: number) => 640 - (x - 1000) * 0.15;
const frontBottom = (x: number) => frontTop(x) + 14;
const backEdge = (x: number) => 700 - (x - 1090) * (60 / 510);

const CANOPY_FASCIA = `M1000 ${frontTop(1000)} L1600 ${frontTop(1600)} L1600 ${frontBottom(1600)} L1000 ${frontBottom(1000)} Z`;
const CANOPY_UNDERSIDE = `M1000 ${frontBottom(1000)} L1600 ${frontBottom(1600)} L1600 ${round1(backEdge(1600))} L1090 ${backEdge(1090)} Z`;

// Solar-panel ribs (front to back) and two longitudinal rails.
const CANOPY_RIBS = Array.from({ length: 17 }, (_, i) => {
  const t = i / 16;
  const px = 1000 + t * 600;
  const qx = 1090 + t * 510;
  return `M${round1(px)} ${round1(frontBottom(px))} L${round1(qx)} ${round1(backEdge(qx))}`;
}).join(' ');

const CANOPY_RAILS = [1 / 3, 2 / 3]
  .map((s) => {
    const ax = 1000 + s * 90;
    const ay = frontBottom(1000) + s * (backEdge(1090) - frontBottom(1000));
    const by = frontBottom(1600) + s * (backEdge(1600) - frontBottom(1600));
    return `M${round1(ax)} ${round1(ay)} L1600 ${round1(by)}`;
  })
  .join(' ');

const FASCIA_JOINTS = Array.from({ length: 15 }, (_, i) => {
  const x = 1000 + (i + 1) * 37.5;
  return `M${round1(x)} ${round1(frontTop(x))} V${round1(frontBottom(x))}`;
}).join(' ');

// Branching tree-column: trunk, then three limbs reaching the canopy.
const treePath = (x: number) => {
  const split = 900;
  const left = x - 80;
  const right = x + 90;
  const mid = x + 12;
  return [
    `M${x} ${GROUND} L${x} ${split}`,
    `M${x} ${split} Q${x - 12} ${split - 60} ${left} ${round1(backEdge(left))}`,
    `M${x} ${split} Q${x + 16} ${split - 70} ${right} ${round1(backEdge(right))}`,
    `M${x} ${split} L${mid} ${round1(backEdge(mid))}`,
  ].join(' ');
};

// Claustra blocks between portals, snapped to the 16-unit module.
const PERF_BLOCKS = PORTALS.slice(0, -1).map((c, i) => {
  const next = PORTALS[i + 1];
  const x = Math.ceil((c + 68) / PERF) * PERF;
  const w = Math.floor((next - 68 - x) / PERF) * PERF;
  return { x, y: 848, w, h: 96 };
});

// The main trace in the top-left corner (ends at the coordinate tag).
const MAIN_TRACE = 'M0 120 H110 L150 160 H270 L300 190';

const NSS = 'non-scaling-stroke' as const;

/* ------------------------------------------------------------------------- */
/* Component                                                                  */
/* ------------------------------------------------------------------------- */

export const CampusBackground = ({
  theme = 'system',
  intensity = 1,
  className = '',
}: CampusBackgroundProps) => {
  const k = Math.max(0, Math.min(1.5, intensity));

  return (
    <div
      className={`${styles.root} ${className}`}
      data-theme={theme}
      style={{ '--cb-k': k } as CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.sky} />

      {/* 42° lattice */}
      <svg className={styles.grid} xmlns="http://www.w3.org/2000/svg" focusable="false">
        <defs>
          <pattern id="cb-iso-a" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
            <path d="M0 0 V32" stroke="currentColor" strokeWidth="1" fill="none" />
          </pattern>
          <pattern id="cb-iso-b" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(-42)">
            <path d="M0 0 V32" stroke="currentColor" strokeWidth="1" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cb-iso-a)" />
        <rect width="100%" height="100%" fill="url(#cb-iso-b)" />
      </svg>

      {/* Circuit corner, top-left */}
      <svg
        className={`${styles.corner} ${styles.cornerLeft}`}
        viewBox="0 0 520 300"
        preserveAspectRatio="xMinYMin meet"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d={MAIN_TRACE} vectorEffect={NSS} />
          <path d="M70 0 V54 L104 88 H186" vectorEffect={NSS} />
          <path d="M0 216 H54 L84 246 H140" vectorEffect={NSS} />
          <path d="M220 40 L262 22 L300 64 L352 48" strokeDasharray="2 5" vectorEffect={NSS} />
          <circle cx="300" cy="190" r="7" opacity="0.5" vectorEffect={NSS} />
          <circle cx="186" cy="88" r="6" opacity="0.5" vectorEffect={NSS} />
        </g>
        <g fill="currentColor">
          <circle cx="300" cy="190" r="3" />
          <circle cx="186" cy="88" r="2.5" />
          <circle cx="140" cy="246" r="2.5" />
          <circle cx="220" cy="40" r="2" />
          <circle cx="262" cy="22" r="2" />
          <circle cx="300" cy="64" r="2" />
          <circle cx="352" cy="48" r="2" />
        </g>
        <text x="314" y="194">
          32.22 N  7.94 W
        </text>
      </svg>

      {/* Circuit corner, top-right */}
      <svg
        className={`${styles.corner} ${styles.cornerRight}`}
        viewBox="0 0 520 300"
        preserveAspectRatio="xMaxYMin meet"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M520 150 H420 L384 114 H290 L262 86" vectorEffect={NSS} />
          <path d="M470 0 V40 L440 70 H330" vectorEffect={NSS} />
          <path d="M520 236 H460 L430 266 H372" vectorEffect={NSS} />
          <path d="M120 60 L170 30 L200 92 L150 128 L90 110" strokeDasharray="2 5" vectorEffect={NSS} />
          <circle cx="262" cy="86" r="7" opacity="0.5" vectorEffect={NSS} />
        </g>
        <g fill="currentColor">
          <circle cx="262" cy="86" r="3" />
          <circle cx="330" cy="70" r="2.5" />
          <circle cx="372" cy="266" r="2.5" />
          <circle cx="120" cy="60" r="2" />
          <circle cx="170" cy="30" r="2.5" />
          <circle cx="200" cy="92" r="2" />
          <circle cx="150" cy="128" r="2" />
          <circle cx="90" cy="110" r="2" />
        </g>
      </svg>

      {/* Campus elevation */}
      <svg
        className={styles.horizon}
        viewBox="0 520 1600 480"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <defs>
          {/* Square claustra perforations */}
          <pattern id="cb-perf" width={PERF} height={PERF} patternUnits="userSpaceOnUse">
            <rect x="5" y="5" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          {/* Lattice strip from the tower facade */}
          <pattern id="cb-lattice" x="128" y="714" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M0 9 L9 0 L18 9 L9 18 Z M9 0 V18" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>

        <g className={styles.art} fill="none" stroke="currentColor" strokeWidth="1">
          {/* Ground and paving drain line */}
          <path d={`M0 ${GROUND} H1600`} vectorEffect={NSS} />
          <path d="M240 1000 L900 976" strokeDasharray="3 6" vectorEffect={NSS} />

          {/* Tower: low wing with band + slots, tall wing with lattice strip */}
          <path d={`M14 ${GROUND} V724 H96 V700 H${FACADE_X0} V${GROUND}`} vectorEffect={NSS} />
          <rect x="14" y="742" width="82" height="14" vectorEffect={NSS} />
          {[26, 40, 54, 68, 82].map((x) => (
            <rect key={x} x={x} y="770" width="5" height="180" vectorEffect={NSS} />
          ))}
          <rect x="128" y="714" width="18" height="236" fill="url(#cb-lattice)" vectorEffect={NSS} />
          {[112, 132, 152, 172].map((x) => (
            <path key={x} d={`M${x} 706 h6 v10 h-6`} vectorEffect={NSS} />
          ))}

          {/* Long facade + parapet shadow line */}
          <path d={`M${FACADE_X0} ${FACADE_TOP} H1600`} vectorEffect={NSS} />
          <path d={`M${FACADE_X0} ${FACADE_TOP + 12} H1600`} strokeOpacity="0.5" vectorEffect={NSS} />

          {/* Stepped portals with columns and base buttresses */}
          {PORTALS.map((c) => (
            <g key={c}>
              <rect x={c - 55} y="820" width="110" height={GROUND - 820} vectorEffect={NSS} />
              <rect x={c - 42} y="836" width="84" height={GROUND - 836} vectorEffect={NSS} />
              <rect
                x={c - 30}
                y="852"
                width="60"
                height={GROUND - 852}
                fill="currentColor"
                fillOpacity="0.12"
                vectorEffect={NSS}
              />
              <path d={`M${c - 10} 852 V${GROUND} M${c + 10} 852 V${GROUND}`} vectorEffect={NSS} />
              <path
                d={`M${c - 55} ${GROUND} L${c - 42} ${GROUND - 26} M${c + 55} ${GROUND} L${c + 42} ${GROUND - 26}`}
                vectorEffect={NSS}
              />
            </g>
          ))}

          {/* Claustra grids */}
          {PERF_BLOCKS.map((b) => (
            <rect key={b.x} x={b.x} y={b.y} width={b.w} height={b.h} fill="url(#cb-perf)" stroke="none" />
          ))}

          {/* Solar pergola canopy */}
          <path d={CANOPY_UNDERSIDE} fill="currentColor" fillOpacity="0.06" vectorEffect={NSS} />
          <path d={CANOPY_RIBS} strokeOpacity="0.7" vectorEffect={NSS} />
          <path d={CANOPY_RAILS} strokeOpacity="0.7" vectorEffect={NSS} />
          <path d={CANOPY_FASCIA} className={styles.solid} vectorEffect={NSS} />
          <path d={FASCIA_JOINTS} strokeOpacity="0.6" vectorEffect={NSS} />

          {/* Tree-columns: a base-coloured halo knocks out the facade behind each limb */}
          {COLUMNS.map((x) => (
            <g key={x} strokeLinecap="round">
              <path d={treePath(x)} className={styles.halo} strokeWidth="7" vectorEffect={NSS} />
              <path d={treePath(x)} strokeWidth="2" vectorEffect={NSS} />
            </g>
          ))}
        </g>
      </svg>

      <div className={styles.veil} />
    </div>
  );
};
