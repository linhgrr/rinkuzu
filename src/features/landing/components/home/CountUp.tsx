interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

/** Renders the real metric in the server response instead of animating hydration state. */
export function CountUp({ value, prefix = '', suffix = '', className }: CountUpProps) {
  return (
    <span className={className}>
      {prefix}
      {value.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}
