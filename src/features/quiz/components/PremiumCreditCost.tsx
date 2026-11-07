import Image from 'next/image';

/** The credit coin with a visible label, e.g. "Unlock · 1 credit" (RIN-1014). */
export function PremiumCreditCost({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/images/premium-credit-coin.png"
        alt=""
        width={28}
        height={28}
        sizes="28px"
        className="size-7 shrink-0 object-contain"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
