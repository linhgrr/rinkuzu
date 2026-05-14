'use client';

import { CSSProperties, ReactElement, useEffect, useMemo, useState } from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';

import { cn } from '@/lib/utils';

interface Sparkle {
  id: string;
  x: string;
  y: string;
  color: string;
  delay: number;
  scale: number;
  lifespan: number;
}

interface SparklesTextProps {
  /**
   * @default <div />
   * @type ReactElement
   * @description
   * The component to be rendered as the text
   * */
  as?: ReactElement;

  /**
   * @default ""
   * @type string
   * @description
   * The className of the text
   */
  className?: string;

  /**
   * @required
   * @type string
   * @description
   * The text to be displayed
   * */
  text: string;

  /**
   * @default 10
   * @type number
   * @description
   * The count of sparkles
   * */
  sparklesCount?: number;

  /**
   * @default "{first: '#9E7AFF', second: '#FE8BBB'}"
   * @type string
   * @description
   * The colors of the sparkles
   * */
  colors?: {
    first: string;
    second: string;
  };
}

type SparkleColors = NonNullable<SparklesTextProps['colors']>;

const SPARKLE_PATH =
  'M9.83.84c.23-.63 1.12-.63 1.35 0l.68 1.88c.54 1.47.53 3.67 1.64 4.78 1.11 1.11 3.31 1.1 4.78 1.64l1.88.69c.63.23.63 1.12 0 1.35l-1.88.68c-1.47.54-3.67.53-4.78 1.64-1.11 1.11-1.1 3.31-1.64 4.78l-.68 1.88c-.23.63-1.12.63-1.35 0l-.68-1.88c-.54-1.47-.53-3.67-1.64-4.78-1.11-1.11-3.31-1.1-4.78-1.64l-1.88-.68c-.63-.23-.63-1.12 0-1.35l1.88-.69c1.47-.54 3.67-.53 4.78-1.64 1.11-1.11 1.1-3.31 1.64-4.78z';

function createSparkle(colors: SparkleColors): Sparkle {
  const starX = `${Math.random() * 100}%`;
  const starY = `${Math.random() * 100}%`;
  const color = Math.random() > 0.5 ? colors.first : colors.second;
  const delay = Math.random() * 2;
  const scale = Math.random() * 1 + 0.3;
  const lifespan = Math.random() * 10 + 5;
  const id = `${starX}-${starY}-${Date.now()}`;

  return { id, x: starX, y: starY, color, delay, scale, lifespan };
}

function createSparkles(count: number, colors: SparkleColors) {
  return Array.from({ length: count }, () => createSparkle(colors));
}

function SparklesLayer({
  sparkleColors,
  sparklesCount,
}: {
  sparkleColors: SparkleColors;
  sparklesCount: number;
}) {
  const [sparkles, setSparkles] = useState<Sparkle[]>(() =>
    createSparkles(sparklesCount, sparkleColors),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSparkles((currentSparkles) =>
        currentSparkles.map((sparkle) =>
          sparkle.lifespan <= 0
            ? createSparkle(sparkleColors)
            : { ...sparkle, lifespan: sparkle.lifespan - 0.1 },
        ),
      );
    }, 100);

    return () => clearInterval(interval);
  }, [sparkleColors]);

  return (
    <>
      {sparkles.map((sparkle) => (
        <Sparkle key={sparkle.id} {...sparkle} />
      ))}
    </>
  );
}

const SparklesText: React.FC<SparklesTextProps> = ({
  text,
  colors = { first: '#9E7AFF', second: '#FE8BBB' },
  className,
  sparklesCount = 10,
  ...props
}) => {
  const sparkleColors = useMemo(
    () => ({ first: colors.first, second: colors.second }),
    [colors.first, colors.second],
  );
  const sparkleKey = `${sparkleColors.first}-${sparkleColors.second}-${sparklesCount}`;

  return (
    <div
      className={cn('text-6xl font-bold', className)}
      {...props}
      style={
        {
          '--sparkles-first-color': `${colors.first}`,
          '--sparkles-second-color': `${colors.second}`,
        } as CSSProperties
      }
    >
      <span className="relative inline-block">
        <LazyMotion features={domAnimation}>
          <SparklesLayer
            key={sparkleKey}
            sparkleColors={sparkleColors}
            sparklesCount={sparklesCount}
          />
        </LazyMotion>
        <strong>{text}</strong>
      </span>
    </div>
  );
};

const Sparkle: React.FC<Sparkle> = ({ id, x, y, color, delay, scale }) => {
  return (
    <m.svg
      key={id}
      className="pointer-events-none absolute z-20"
      initial={{ opacity: 0, left: x, top: y }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, scale, 0],
        rotate: [75, 120, 150],
      }}
      transition={{ duration: 0.8, repeat: Infinity, delay }}
      width="21"
      height="21"
      viewBox="0 0 21 21"
    >
      <path d={SPARKLE_PATH} fill={color} />
    </m.svg>
  );
};

export { SparklesText };
