export interface PayOSPaymentRequest {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl: string;
  returnUrl: string;
  signature: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  expiredAt?: number;
}

export interface PayOSPaymentResponse {
  code: string;
  desc: string;
  data?: {
    bin: string;
    accountNo?: string;
    accountName?: string;
    acqId?: number;
    amount: number;
    currency: string;
    orderCode: number;
    status: string;
    paymentLinkId?: string;
    checkoutUrl?: string;
    qrCode?: string;
  };
}

export interface PayOSVerifyResponse {
  code: string;
  desc: string;
  data?: {
    orderCode: string;
    amount: number;
    description: string;
    accountNo: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
    status?: string;
    counterAccountBankId: string;
    counterAccountBankName: string;
    counterAccountName: string;
    counterAccountNumber: string;
    virtualAccountName: string;
    virtualAccountNumber: string;
    location: string;
  };
}

export interface IPayOSService {
  createPayment(
    orderCode: number,
    amount: number,
    description: string,
    returnUrl: string,
    cancelUrl: string,
    buyerEmail?: string,
    buyerName?: string
  ): Promise<PayOSPaymentResponse>;
  
  verifyPayment(orderCode: number): Promise<PayOSVerifyResponse>;
  getPaymentInfo(orderCode: number): Promise<PayOSVerifyResponse>;
  testConnection(): Promise<boolean>;
} 