import CheckoutClient from './CheckoutClient';

type CheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : (value?.[0] ?? null);
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const planId = firstParam(params['plan']);
  const orderId = firstParam(params['order']);
  const hasProviderCallback =
    params['code'] !== undefined &&
    (params['status'] !== undefined ||
      params['cancel'] !== undefined ||
      params['orderCode'] !== undefined);
  return (
    <CheckoutClient planId={planId} orderId={orderId} hasProviderCallback={hasProviderCallback} />
  );
}
