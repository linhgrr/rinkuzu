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
      className="inline-flex w-fit rounded-[10px] bg-[#d9d5d040] p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3.5 py-1 text-sm transition-colors ${
            value === option.value
              ? 'bg-white font-semibold text-[#2a0b00] shadow-[1px_1px_2px_rgba(0,0,0,0.03)]'
              : 'text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
