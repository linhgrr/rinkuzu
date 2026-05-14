interface LevelBadgeProps {
  level?: number;
  className?: string;
  width?: number | string;
  height?: number | string;
}

export function LevelBadge({ level, className = '', width = 120, height = 120 }: LevelBadgeProps) {
  const leaves = [];
  const R = 82;
  const cy = 96;

  const random = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Left Wreath: angle 90 (bottom) to 180 (left)
  for (let a = 90; a <= 180; a += 15) {
    if (a === 90) continue;

    const rad = (a * Math.PI) / 180;
    const x = 100 + R * Math.cos(rad);
    const y = cy + R * Math.sin(rad);
    const tangent = a + 90;

    leaves.push({
      x,
      y,
      rot1: tangent + 25,
      rot2: tangent - 35,
      scale1: 0.75 + random(a) * 0.25,
      scale2: 0.65 + random(a + 1) * 0.25,
    });
  }

  // Right Wreath: angle 90 (bottom) to 0 (right)
  for (let a = 90; a >= 0; a -= 15) {
    if (a === 90) continue;

    const rad = (a * Math.PI) / 180;
    const x = 100 + R * Math.cos(rad);
    const y = cy + R * Math.sin(rad);
    const tangent = a - 90;

    leaves.push({
      x,
      y,
      rot1: tangent - 25,
      rot2: tangent + 35,
      scale1: 0.75 + random(a) * 0.25,
      scale2: 0.65 + random(a + 1) * 0.25,
    });
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        width={width}
        height={height}
        className="filter drop-shadow-md"
      >
        <defs>
          <linearGradient id="badgeGoldOuter" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3c669" />
            <stop offset="30%" stopColor="#e5a840" />
            <stop offset="70%" stopColor="#b0741a" />
            <stop offset="100%" stopColor="#7a4d0b" />
          </linearGradient>

          <linearGradient id="badgeGoldRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef0a5" />
            <stop offset="25%" stopColor="#d28f24" />
            <stop offset="50%" stopColor="#fdf0a6" />
            <stop offset="75%" stopColor="#d28f24" />
            <stop offset="100%" stopColor="#8c5810" />
          </linearGradient>

          <radialGradient id="badgeGreenOrb" cx="45%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#9dfb7d" />
            <stop offset="40%" stopColor="#30c226" />
            <stop offset="80%" stopColor="#1e8916" />
            <stop offset="100%" stopColor="#0a3f05" />
          </radialGradient>

          <linearGradient id="badgeGoldLeaf" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde08b" />
            <stop offset="100%" stopColor="#d28f24" />
          </linearGradient>

          <filter id="badgeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <path id="badgeLeafTemplate" d="M 0 0 C 10 -12 22 -10 28 0 C 22 10 10 12 0 0 Z" />
        </defs>

        {/* Background Glow */}
        <circle cx="100" cy="100" r="85" fill="#30c226" opacity="0.4" filter="url(#badgeGlow)" />

        {/* Outer Frame */}
        <circle cx="100" cy="100" r="76" fill="url(#badgeGoldOuter)" />
        <circle cx="100" cy="100" r="74" fill="url(#badgeGoldRing)" />
        <circle cx="100" cy="100" r="62" fill="#583101" />

        {/* Inner Green Orb */}
        <circle cx="100" cy="100" r="60" fill="url(#badgeGreenOrb)" />

        {/* Inner Orb Specular Highlight */}
        <ellipse cx="100" cy="55" rx="35" ry="15" fill="#ffffff" opacity="0.15" />
        <ellipse cx="100" cy="55" rx="25" ry="8" fill="#ffffff" opacity="0.25" />

        {/* 3D Gold Star (10 Facets) */}
        <g transform="translate(0, 3)">
          {/* Top Point */}
          <path d="M 100 45 L 109.4 72 L 100 85 Z" fill="#ffb300" />
          <path d="M 100 45 L 90.6 72 L 100 85 Z" fill="#ffe082" />

          {/* Right Point */}
          <path d="M 138 72.6 L 109.4 72 L 100 85 Z" fill="#ffb300" />
          <path d="M 138 72.6 L 115.2 89.9 L 100 85 Z" fill="#f57f17" />

          {/* Bottom Right Point */}
          <path d="M 123.5 117.4 L 115.2 89.9 L 100 85 Z" fill="#f57f17" />
          <path d="M 123.5 117.4 L 100 101 L 100 85 Z" fill="#e65100" />

          {/* Bottom Left Point */}
          <path d="M 76.5 117.4 L 100 101 L 100 85 Z" fill="#e65100" />
          <path d="M 76.5 117.4 L 84.8 89.9 L 100 85 Z" fill="#ffca28" />

          {/* Left Point */}
          <path d="M 62 72.6 L 84.8 89.9 L 100 85 Z" fill="#ffca28" />
          <path d="M 62 72.6 L 90.6 72 L 100 85 Z" fill="#ffe082" />
        </g>

        {/* Golden Laurel Wreath Stems */}
        <path
          d="M 100 178 A 82 82 0 0 1 18 96"
          fill="none"
          stroke="url(#badgeGoldOuter)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 100 178 A 82 82 0 0 0 182 96"
          fill="none"
          stroke="url(#badgeGoldOuter)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Wreath Leaves */}
        {leaves.map((leaf) => (
          <g key={`${leaf.x}-${leaf.y}-${leaf.rot1}-${leaf.rot2}`}>
            <use
              href="#badgeLeafTemplate"
              x="0"
              y="0"
              transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.rot1}) scale(${leaf.scale1})`}
              fill="url(#badgeGoldLeaf)"
            />
            <use
              href="#badgeLeafTemplate"
              x="0"
              y="0"
              transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.rot2}) scale(${leaf.scale2})`}
              fill="url(#badgeGoldLeaf)"
              opacity="0.95"
            />
          </g>
        ))}

        {/* Bottom Ribbon / Tie */}
        <path d="M 94 175 L 106 175 L 110 188 L 90 188 Z" fill="url(#badgeGoldOuter)" />
        <path
          d="M 100 176 C 85 186 80 198 90 198 C 96 198 100 186 100 178 C 100 186 104 198 110 198 C 120 198 115 186 100 176"
          fill="#fdf0a6"
        />
      </svg>

      {/* Level Text positioned over the badge in HTML */}
      {level !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
          <div className="bg-black/40 backdrop-blur-sm px-3 md:px-4 py-0.5 md:py-1 rounded-full mt-32 md:mt-[112px] border border-white/20 shadow-xl min-w-max">
            <span className="text-[10px] md:text-sm font-black text-white uppercase tracking-wider drop-shadow-md whitespace-nowrap">
              Level {level}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
