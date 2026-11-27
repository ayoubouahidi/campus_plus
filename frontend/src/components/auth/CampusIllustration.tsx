import React from 'react';

/**
 * CampusIllustration: the 1337 Benguerir building, drawn as a vector so it stays sharp on any screen
 * (it replaces a low-resolution photo on the login pages). Same palette as the site-wide CampusBackground:
 * terracotta facade, sunlit sky, violet circuit traces. At night (dark mode) the windows and the claustra
 * strip glow warm and stars come out.
 *
 * Built from the photo: a low wing with a glass strip, a white band and tall slot windows; a taller block
 * with the white claustra (lattice) strip and the "1337" letters on its top edge; palms and hedges in front.
 *
 * Purely decorative and static: aria-hidden, no client JS (Server Component). Colours are CSS variables on
 * the root, switched for dark mode in the <style> block below.
 *
 * The dashboard has a copy of this file (dashboard_campus/components/CampusIllustration.tsx); only the dark
 * selector differs (`.dark` class there, prefers-color-scheme here).
 */

export interface CampusIllustrationProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/* ------------------------------------------------------------------------- */
/* Colours                                                                    */
/* ------------------------------------------------------------------------- */

const LIGHT = `
  --ci-sky-top:#8db9ec; --ci-sky-mid:#cfe1f6; --ci-sky-low:#f7e4d4; --ci-sun:rgba(255,190,130,.55);
  --ci-moon-a:0; --ci-star-a:0; --ci-circuit:#7c3aed; --ci-circuit-a:.35; --ci-lattice-a:.07;
  --ci-far:#c97a55; --ci-far-win:#a95e3c; --ci-trees:#46714a;
  --ci-wall:#cf6538; --ci-wall-hi:#dc7848; --ci-wall-lo:#b9542c; --ci-joint:rgba(110,40,15,.18);
  --ci-parapet:#e2865a; --ci-band:#f2ede6; --ci-band-lo:#d9d0c4; --ci-shadow:rgba(90,30,10,.22);
  --ci-glass:#2c4766; --ci-glass-hi:#6f97c4; --ci-frame:#f4efe8;
  --ci-claustra:#f6f3ee; --ci-hole:#7a3f26;
  --ci-letter:#3b2a23; --ci-letter-side:#1d1410; --ci-letter-glow:transparent;
  --ci-trunk:#8c6b4b; --ci-trunk-ring:#6d5139; --ci-leaf:#3d7a3c; --ci-leaf-hi:#62a04a; --ci-rib:#2c5a2c;
  --ci-hedge:#3e6d35; --ci-hedge-hi:#5a8c45;
  --ci-plaza:#eadfcf; --ci-plaza-edge:#cdbba4; --ci-grass:#7fae4c; --ci-grass-lo:#5f913a; --ci-cast:rgba(60,40,20,.16);
`;

const DARK = `
  --ci-sky-top:#030817; --ci-sky-mid:#0f1a36; --ci-sky-low:#2b1d3d; --ci-sun:rgba(139,92,246,.28);
  --ci-moon-a:1; --ci-star-a:1; --ci-circuit:#a78bfa; --ci-circuit-a:.45; --ci-lattice-a:.08;
  --ci-far:#5a2a1a; --ci-far-win:#f2b25c; --ci-trees:#0f1d17;
  --ci-wall:#86391f; --ci-wall-hi:#97452a; --ci-wall-lo:#6c2c17; --ci-joint:rgba(0,0,0,.22);
  --ci-parapet:#a2502f; --ci-band:#b9ada0; --ci-band-lo:#8f8478; --ci-shadow:rgba(0,0,0,.35);
  --ci-glass:#e9a94f; --ci-glass-hi:#ffe0a1; --ci-frame:#cdbfae;
  --ci-claustra:#d9cfc2; --ci-hole:#ffc46b;
  --ci-letter:#20140f; --ci-letter-side:#0a0604; --ci-letter-glow:rgba(255,196,107,.35);
  --ci-trunk:#4b3728; --ci-trunk-ring:#30231a; --ci-leaf:#173521; --ci-leaf-hi:#24502f; --ci-rib:#0d2014;
  --ci-hedge:#14291a; --ci-hedge-hi:#1f3d26;
  --ci-plaza:#3a3045; --ci-plaza-edge:#2a2233; --ci-grass:#1d3624; --ci-grass-lo:#142a1b; --ci-cast:rgba(0,0,0,.3);
`;

// Student site: dark mode follows the OS (the same rule as every `dark:` class in this app).
const CSS = `.ci-root{${LIGHT}} @media (prefers-color-scheme: dark){.ci-root{${DARK}}}`;

/* ------------------------------------------------------------------------- */
/* Geometry (viewBox 0 0 900 1000, anchored bottom-right)                     */
/* ------------------------------------------------------------------------- */

const GROUND = 838;
const WING = { x0: 60, x1: 430, top: 410 };
const BLOCK = { x0: 430, x1: 868, top: 300 };
const CLAUSTRA = { x: 528, y: 330, w: 72, h: 470 };
const SLOTS = [100, 140, 180, 220, 260, 300, 340, 380];
const STRIP_MULLIONS = Array.from({ length: 10 }, (_, i) => 85 + i * 34);

const r1 = (n: number) => Math.round(n * 10) / 10;

// "1337" in blocky slab letters (40 × 52), built from rectangles like the real steel letters.
type Box = [number, number, number, number];
const GLYPHS: Record<'1' | '3' | '7', Box[]> = {
  '1': [[14, 0, 12, 52], [4, 0, 22, 11], [6, 41, 28, 11]],
  '3': [[0, 0, 40, 11], [10, 20.5, 30, 11], [0, 41, 40, 11], [29, 0, 11, 52]],
  '7': [[0, 0, 40, 11], [27, 0, 13, 52]],
};
const LETTERS: Array<{ ch: '1' | '3' | '7'; x: number }> = [
  { ch: '1', x: 624 },
  { ch: '3', x: 681 },
  { ch: '3', x: 738 },
  { ch: '7', x: 795 },
];
const LETTER_TOP = 284;

// Palm frond: a leaf from the crown, arching up then drooping to its tip.
const frond = (cx: number, cy: number, angleDeg: number, length: number, width: number, droop: number) => {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tipX = cx + dx * length;
  const tipY = cy + dy * length + droop;
  const mx = cx + dx * length * 0.5;
  const my = cy + dy * length * 0.5 - length * 0.22;
  const nx = -dy * width;
  const ny = dx * width;
  const outline = `M${r1(cx)} ${r1(cy)} Q${r1(mx + nx)} ${r1(my + ny)} ${r1(tipX)} ${r1(tipY)} Q${r1(mx - nx)} ${r1(my - ny)} ${r1(cx)} ${r1(cy)} Z`;
  const rib = `M${r1(cx)} ${r1(cy)} Q${r1(mx)} ${r1(my)} ${r1(tipX)} ${r1(tipY)}`;
  return { outline, rib };
};

type Palm = { base: [number, number]; crown: [number, number]; size: number; bend: number };
const PALMS: Palm[] = [
  { base: [232, GROUND + 4], crown: [214, 556], size: 1, bend: -14 },
  { base: [556, GROUND + 6], crown: [566, 640], size: 0.72, bend: 10 },
  { base: [806, GROUND + 4], crown: [790, 532], size: 1.08, bend: -18 },
];
const FROND_SET: Array<[number, number, number, number]> = [
  // angle, length, width, droop (before scaling); back fronds first, front ones last
  [-150, 100, 17, 30],
  [-30, 104, 17, 34],
  [-118, 84, 15, 10],
  [-62, 86, 15, 12],
  [-90, 70, 13, 0],
  [-178, 96, 16, 50],
  [2, 98, 16, 56],
  [150, 80, 15, 66],
  [32, 78, 15, 64],
  [-160, 74, 13, 64],
  [-16, 76, 13, 66],
];

const trunkPath = ({ base, crown, bend }: Palm, w0: number, w1: number) => {
  const [bx, by] = base;
  const [cx, cy] = crown;
  const midX = (bx + cx) / 2 + bend;
  const midY = (by + cy) / 2;
  return `M${bx - w0} ${by} Q${midX - (w0 + w1) / 2} ${midY} ${cx - w1} ${cy} L${cx + w1} ${cy} Q${midX + (w0 + w1) / 2} ${midY} ${bx + w0} ${by} Z`;
};
const trunkSpine = ({ base, crown, bend }: Palm) => {
  const [bx, by] = base;
  const [cx, cy] = crown;
  return `M${bx} ${by} Q${(bx + cx) / 2 + bend} ${(by + cy) / 2} ${cx} ${cy}`;
};

const STARS: Array<[number, number, number]> = [
  [60, 70, 1.4], [140, 150, 1], [230, 60, 1.2], [330, 120, 0.9], [420, 40, 1.3], [500, 170, 1], [610, 90, 1.5],
  [700, 30, 1], [780, 130, 1.2], [860, 60, 1], [380, 220, 0.8], [90, 250, 1], [560, 250, 0.9], [820, 220, 1.1],
];

/* ------------------------------------------------------------------------- */
/* Component                                                                  */
/* ------------------------------------------------------------------------- */

export const CampusIllustration = React.forwardRef<HTMLDivElement, CampusIllustrationProps>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`ci-root ${className}`} aria-hidden="true" {...props}>
      <style>{CSS}</style>
      <svg
        viewBox="0 0 900 1000"
        preserveAspectRatio="xMaxYMax slice"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        className="block h-full w-full"
      >
        <defs>
          <linearGradient id="ci-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--ci-sky-top)' }} />
            <stop offset="0.55" style={{ stopColor: 'var(--ci-sky-mid)' }} />
            <stop offset="0.84" style={{ stopColor: 'var(--ci-sky-low)' }} />
          </linearGradient>
          <radialGradient id="ci-sun" cx="0.88" cy="0.06" r="0.55">
            <stop offset="0" style={{ stopColor: 'var(--ci-sun)' }} />
            <stop offset="1" stopOpacity="0" style={{ stopColor: 'var(--ci-sun)' }} />
          </radialGradient>
          <linearGradient id="ci-block" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0" style={{ stopColor: 'var(--ci-wall-hi)' }} />
            <stop offset="0.6" style={{ stopColor: 'var(--ci-wall)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ci-wall-lo)' }} />
          </linearGradient>
          <linearGradient id="ci-wing" x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0" style={{ stopColor: 'var(--ci-wall-lo)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--ci-wall)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ci-wall-hi)' }} />
          </linearGradient>
          <linearGradient id="ci-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--ci-glass-hi)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ci-glass)' }} />
          </linearGradient>
          <linearGradient id="ci-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--ci-grass)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ci-grass-lo)' }} />
          </linearGradient>
          {/* The claustra: white lattice with leaf-shaped openings at ±42° */}
          <pattern id="ci-claustra" width="18" height="22" patternUnits="userSpaceOnUse" x={CLAUSTRA.x} y={CLAUSTRA.y}>
            <rect width="18" height="22" style={{ fill: 'var(--ci-claustra)' }} />
            <ellipse cx="4.5" cy="5.5" rx="2.2" ry="4.6" transform="rotate(42 4.5 5.5)" style={{ fill: 'var(--ci-hole)' }} />
            <ellipse cx="13.5" cy="16.5" rx="2.2" ry="4.6" transform="rotate(-42 13.5 16.5)" style={{ fill: 'var(--ci-hole)' }} />
            <path d="M9 0 L13 6 L9 11 L5 6 Z" style={{ fill: 'var(--ci-hole)' }} opacity="0.75" />
          </pattern>
          {/* 42° lattice of the site background, faint, in the sky */}
          <pattern id="ci-iso" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
            <path d="M0 0 V32" stroke="currentColor" strokeWidth="1" fill="none" />
          </pattern>
          <mask id="ci-crescent">
            <rect x="700" y="60" width="120" height="120" fill="#fff" />
            <circle cx="770" cy="112" r="17" fill="#000" />
          </mask>
          <filter id="ci-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Sky */}
        <rect width="900" height="1000" fill="url(#ci-sky)" />
        <rect width="900" height="1000" fill="url(#ci-sun)" />
        <rect width="900" height="560" fill="url(#ci-iso)" style={{ color: 'var(--ci-circuit)', opacity: 'var(--ci-lattice-a)' }} />
        <g style={{ fill: '#ffffff', opacity: 'var(--ci-star-a)' }}>
          {STARS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
        <g style={{ opacity: 'var(--ci-moon-a)' }}>
          <circle cx="760" cy="120" r="34" fill="#fef3c7" opacity="0.18" filter="url(#ci-soft)" />
          <circle cx="760" cy="120" r="20" fill="#fef3c7" mask="url(#ci-crescent)" />
        </g>

        {/* Circuit traces and the coordinate tag, as on the site background */}
        <g style={{ color: 'var(--ci-circuit)', opacity: 'var(--ci-circuit-a)' }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M0 120 H110 L150 160 H270 L300 190" />
            <path d="M70 0 V54 L104 88 H186" />
            <path d="M220 40 L262 22 L300 64 L352 48" strokeDasharray="2 5" />
            <circle cx="300" cy="190" r="8" opacity="0.5" />
          </g>
          <g fill="currentColor">
            <circle cx="300" cy="190" r="3.5" />
            <circle cx="186" cy="88" r="3" />
            <circle cx="220" cy="40" r="2.2" />
            <circle cx="262" cy="22" r="2.2" />
            <circle cx="300" cy="64" r="2.2" />
            <circle cx="352" cy="48" r="2.2" />
          </g>
          <text x="316" y="195" fill="currentColor" style={{ font: '500 12px ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.04em' }}>
            32.22 N 7.94 W
          </text>
        </g>

        {/* Far building (left) and trees (right), hazier */}
        <g>
          <rect x="-10" y="470" width="82" height={GROUND - 470} style={{ fill: 'var(--ci-far)' }} />
          <rect x="-10" y="470" width="82" height="8" style={{ fill: 'var(--ci-parapet)' }} opacity="0.6" />
          {[510, 590, 670, 750].map((y) => (
            <rect key={y} x="8" y={y} width="44" height="34" rx="2" style={{ fill: 'var(--ci-far-win)' }} opacity="0.9" />
          ))}
          <g style={{ fill: 'var(--ci-trees)' }}>
            <circle cx="884" cy="600" r="46" />
            <circle cx="900" cy="560" r="40" />
            <circle cx="872" cy="680" r="52" />
            <rect x="850" y="660" width="60" height={GROUND - 660} />
          </g>
        </g>

        {/* Low wing: glass strip, white band, tall slot windows */}
        <g>
          <rect x={WING.x0} y={WING.top} width={WING.x1 - WING.x0} height={GROUND - WING.top} fill="url(#ci-wing)" />
          <rect x={WING.x0} y={WING.top} width={WING.x1 - WING.x0} height="7" style={{ fill: 'var(--ci-parapet)' }} />
          {/* Glass strip with mullions */}
          <rect x="82" y="444" width="346" height="34" style={{ fill: 'var(--ci-frame)' }} />
          <rect x="85" y="447" width="340" height="28" fill="url(#ci-glass)" />
          {STRIP_MULLIONS.map((x) => (
            <rect key={x} x={x} y="447" width="3" height="28" style={{ fill: 'var(--ci-frame)' }} />
          ))}
          {/* White band, with its shadow on the wall */}
          <rect x="72" y="478" width={WING.x1 - 72} height="52" style={{ fill: 'var(--ci-band)' }} />
          <rect x="72" y="524" width={WING.x1 - 72} height="6" style={{ fill: 'var(--ci-band-lo)' }} />
          <rect x="72" y="530" width={WING.x1 - 72} height="10" style={{ fill: 'var(--ci-shadow)' }} />
          {[140, 210, 280, 350].map((x) => (
            <rect key={x} x={x} y="478" width="1.5" height="46" style={{ fill: 'var(--ci-band-lo)' }} />
          ))}
          {/* Slot windows */}
          {SLOTS.map((x) => (
            <g key={x}>
              <rect x={x - 2} y="550" width="18" height="266" style={{ fill: 'var(--ci-frame)' }} />
              <rect x={x} y="552" width="14" height="262" fill="url(#ci-glass)" />
              {[640, 728].map((y) => (
                <rect key={y} x={x} y={y} width="14" height="2" style={{ fill: 'var(--ci-frame)' }} />
              ))}
              <rect x={x + 16} y="552" width="4" height="264" style={{ fill: 'var(--ci-shadow)' }} />
            </g>
          ))}
          {/* Entrance */}
          <rect x="396" y="760" width="30" height={GROUND - 760} style={{ fill: 'var(--ci-glass)' }} />
          <rect x="392" y="754" width="38" height="6" style={{ fill: 'var(--ci-band)' }} />
        </g>

        {/* Tall block */}
        <g>
          <rect x={BLOCK.x0 + 6} y={BLOCK.top} width="10" height={GROUND - BLOCK.top} style={{ fill: 'var(--ci-shadow)' }} />
          <rect x={BLOCK.x0} y={BLOCK.top} width={BLOCK.x1 - BLOCK.x0} height={GROUND - BLOCK.top} fill="url(#ci-block)" />
          <rect x={BLOCK.x0} y={BLOCK.top} width={BLOCK.x1 - BLOCK.x0} height="6" style={{ fill: 'var(--ci-parapet)' }} />
          <rect x={BLOCK.x0} y={BLOCK.top} width="6" height={GROUND - BLOCK.top} style={{ fill: 'var(--ci-parapet)' }} opacity="0.7" />
          {/* Panel joints */}
          <g style={{ fill: 'var(--ci-joint)' }}>
            {[430, 560, 690].map((y) => (
              <rect key={y} x={BLOCK.x0} y={y} width={BLOCK.x1 - BLOCK.x0} height="1.5" />
            ))}
            {[700].map((x) => (
              <rect key={x} x={x} y={BLOCK.top} width="1.5" height={GROUND - BLOCK.top} />
            ))}
          </g>
          {/* Claustra strip: frame, lattice, inner shadow */}
          <rect x={CLAUSTRA.x - 6} y={CLAUSTRA.y - 6} width={CLAUSTRA.w + 12} height={CLAUSTRA.h + 12} style={{ fill: 'var(--ci-wall-lo)' }} />
          <rect x={CLAUSTRA.x} y={CLAUSTRA.y} width={CLAUSTRA.w} height={CLAUSTRA.h} fill="url(#ci-claustra)" />
          <rect x={CLAUSTRA.x} y={CLAUSTRA.y} width="5" height={CLAUSTRA.h} style={{ fill: 'var(--ci-shadow)' }} />
          <rect x={CLAUSTRA.x} y={CLAUSTRA.y} width={CLAUSTRA.w} height="5" style={{ fill: 'var(--ci-shadow)' }} />
          {/* "1337": a warm glow behind at night, then the extruded letters */}
          <ellipse cx="732" cy="318" rx="130" ry="34" style={{ fill: 'var(--ci-letter-glow)' }} filter="url(#ci-soft)" />
          {LETTERS.map(({ ch, x }, i) => (
            <g key={i}>
              {GLYPHS[ch].map(([bx, by, bw, bh], j) => (
                <rect key={`s${j}`} x={x + bx + 5} y={LETTER_TOP + by + 6} width={bw} height={bh} style={{ fill: 'var(--ci-shadow)' }} />
              ))}
              {GLYPHS[ch].map(([bx, by, bw, bh], j) => (
                <rect key={`d${j}`} x={x + bx + 3} y={LETTER_TOP + by + 3} width={bw} height={bh} style={{ fill: 'var(--ci-letter-side)' }} />
              ))}
              {GLYPHS[ch].map(([bx, by, bw, bh], j) => (
                <rect key={`f${j}`} x={x + bx} y={LETTER_TOP + by} width={bw} height={bh} style={{ fill: 'var(--ci-letter)' }} />
              ))}
            </g>
          ))}
        </g>

        {/* Ground: plaza, grass, hedges, cast shadows */}
        <rect x="0" y={GROUND} width="900" height="34" style={{ fill: 'var(--ci-plaza)' }} />
        <rect x="0" y={GROUND} width="900" height="3" style={{ fill: 'var(--ci-plaza-edge)' }} />
        <rect x="0" y={GROUND + 34} width="900" height={1000 - GROUND - 34} fill="url(#ci-grass)" />
        <path d={`M0 ${GROUND + 34} Q450 ${GROUND + 26} 900 ${GROUND + 34}`} style={{ fill: 'var(--ci-plaza-edge)' }} opacity="0.6" />
        <g style={{ fill: 'var(--ci-cast)' }}>
          <ellipse cx="262" cy={GROUND + 20} rx="70" ry="7" />
          <ellipse cx="580" cy={GROUND + 22} rx="48" ry="5" />
          <ellipse cx="836" cy={GROUND + 20} rx="74" ry="7" />
        </g>
        <g>
          {[
            [84, 22], [118, 18], [150, 16], [330, 18], [362, 14], [470, 16], [640, 18], [676, 14], [720, 16],
          ].map(([x, r]) => (
            <g key={x}>
              <ellipse cx={x} cy={GROUND - r * 0.35} rx={r} ry={r * 0.8} style={{ fill: 'var(--ci-hedge)' }} />
              <ellipse cx={x - r * 0.25} cy={GROUND - r * 0.6} rx={r * 0.55} ry={r * 0.4} style={{ fill: 'var(--ci-hedge-hi)' }} opacity="0.8" />
            </g>
          ))}
        </g>
        {/* Sign post */}
        <rect x="486" y="790" width="3" height="50" style={{ fill: 'var(--ci-letter)' }} />
        <rect x="476" y="776" width="24" height="18" rx="2" style={{ fill: 'var(--ci-hedge)' }} />

        {/* Palms */}
        {PALMS.map((palm) => {
          const [cx, cy] = palm.crown;
          const s = palm.size;
          return (
            <g key={cx}>
              <path d={trunkPath(palm, 8 * s, 5 * s)} style={{ fill: 'var(--ci-trunk)' }} />
              <path
                d={trunkSpine(palm)}
                fill="none"
                strokeWidth={9 * s}
                strokeDasharray="2 7"
                style={{ stroke: 'var(--ci-trunk-ring)' }}
                opacity="0.55"
              />
              {FROND_SET.map(([angle, length, width, droop], i) => {
                const { outline, rib } = frond(cx, cy, angle, length * s, width * s, droop * s);
                return (
                  <g key={i}>
                    <path d={outline} style={{ fill: i % 2 ? 'var(--ci-leaf)' : 'var(--ci-leaf-hi)' }} />
                    <path d={rib} fill="none" strokeWidth="1.2" style={{ stroke: 'var(--ci-rib)' }} opacity="0.6" />
                  </g>
                );
              })}
              <circle cx={cx} cy={cy + 2} r={6 * s} style={{ fill: 'var(--ci-trunk-ring)' }} />
            </g>
          );
        })}
      </svg>
    </div>
  )
);

CampusIllustration.displayName = 'CampusIllustration';
