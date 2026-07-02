export interface PayOSPaymentItem {
  name: string;
  quantity: number;
  price: number;
}

export interface PayOSPaymentRequest {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl: string;
  returnUrl: string;
  signature: string;
  items?: PayOSPaymentItem[];
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  expiredAt?: number;
}

export interface PayOSPaymentSignatureData {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}

export interface PayOSPaymentResponseData {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  currency: string;
  orderCode: number;
  status: PayOSPaymentStatus;
  paymentLinkId: string;
  checkoutUrl: string;
  qrCode: string;
}

export interface PayOSPaymentResponse {
  code: string;
  desc: string;
  data?: PayOSPaymentResponseData | null;
  signature?: string;
}

export type PayOSPaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface PayOSTransaction {
  reference: string;
  amount: number;
  accountNumber: string;
  description: string;
  transactionDateTime: string;
  virtualAccountName: string | null;
  virtualAccountNumber: string | null;
  counterAccountBankId: string | null;
  counterAccountBankName: string | null;
  counterAccountName: string | null;
  counterAccountNumber: string | null;
}

export interface PayOSPaymentLinkData {
  id: string;
  orderCode: number;
  amount: number;
  amountPaid: number;
  amountRemaining: number;
  status: PayOSPaymentStatus;
  createdAt: string;
  transactions: PayOSTransaction[];
  cancellationReason: string | null;
  canceledAt: string | null;
}

export interface PayOSVerifyResponse {
  code: string;
  desc: string;
  data?: PayOSPaymentLinkData | null;
  signature?: string;
}

export interface IPayOSService {
  createPayment(
    orderCode: number,
    amount: number,
    description: string,
    returnUrl: string,
    cancelUrl: string,
    buyerEmail?: string,
    buyerName?: string,
  ): Promise<PayOSPaymentResponse>;

  verifyPayment(orderCode: number): Promise<PayOSVerifyResponse>;
  getPaymentInfo(orderCode: number): Promise<PayOSVerifyResponse>;
  testConnection(): Promise<boolean>;
}
