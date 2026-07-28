interface SegmentedControlOption<Value extends string> {
  label: string;
  value: Value;
}

interface SegmentedControlProps<Value extends string> {
  ariaLabel: string;
  onChange: (value: Value) => void;
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
}

export function SegmentedControl<Value extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex w-fit items-center rounded-control bg-control-surface p-1 font-home"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`relative rounded-sm py-1 text-sub transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            value === option.value
              ? 'bg-neutral-warm-white px-3.5 font-semibold text-neutral-warm-8 shadow-segmented'
              : 'px-2.5 font-normal text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
