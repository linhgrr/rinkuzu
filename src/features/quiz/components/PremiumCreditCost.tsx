import Image from 'next/image';

export function PremiumCreditCost() {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <Image
        src="/images/premium-credit-coin.png"
        alt=""
        width={28}
        height={28}
        sizes="28px"
        className="size-7 shrink-0 object-contain"
        aria-hidden="true"
      />
      <span>-1</span>
    </span>
  );
}
