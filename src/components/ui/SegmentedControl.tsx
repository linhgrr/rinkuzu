interface SegmentedControlOption<Value extends string> {
  label: string;
  value: Value;
}

interface SegmentedControlProps<Value extends string> {
  ariaLabel: string;
  onChange: (value: Value) => void;
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
  /** Id of the element(s) that describe the choice, e.g. a helper line. */
  ariaDescribedBy?: string | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
}

export function SegmentedControl<Value extends string>({
  ariaLabel,
  onChange,
  options,
  value,
  ariaDescribedBy,
  disabled = false,
  id,
}: SegmentedControlProps<Value>) {
  return (
    <div
      role="group"
      id={id}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className="inline-flex w-fit items-center rounded-control bg-control-surface p-1 font-home"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`relative min-h-11 rounded-sm py-1 text-sub transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${
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
