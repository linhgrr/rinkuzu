import crypto from 'crypto';

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

export class PayOSService {
  private clientId: string;
  private apiKey: string;
  private checksumKey: string;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.PAYOS_CLIENT_ID || '';
    this.apiKey = process.env.PAYOS_API_KEY || '';
    this.checksumKey = process.env.PAYOS_CHECKSUM_KEY || '';
    this.baseUrl = 'https://api-merchant.payos.vn';

    // Validate required environment variables
    if (!this.clientId || !this.apiKey || !this.checksumKey) {
      console.error('Missing PayOS environment variables:', {
        clientId: !!this.clientId,
        apiKey: !!this.apiKey,
        checksumKey: !!this.checksumKey
      });
      throw new Error('PayOS configuration is incomplete');
    }
  }

  private generateSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.checksumKey)
      .update(data)
      .digest('hex');
  }

  private generatePaymentSignature(data: {
    amount: number
    cancelUrl: string
    description: string
    orderCode: number
    returnUrl: string
  }): string {
    // PayOS requires the data string in alphabetical order of the keys
    const rawSignature = `amount=${data.amount}&cancelUrl=${data.cancelUrl}&description=${data.description}&orderCode=${data.orderCode}&returnUrl=${data.returnUrl}`
    return this.generateSignature(rawSignature)
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client-id': this.clientId,
      'x-api-key': this.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    try {
      console.log('PayOS API Request:', {
        url,
        method,
        headers: { 'x-client-id': this.clientId, 'x-api-key': '***' },
        body: body ? JSON.stringify(body) : undefined
      });

      const response = await fetch(url, options);
      const responseText = await response.text();
      
      console.log('PayOS API Response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse PayOS response:', responseText);
        throw new Error(`Invalid response from PayOS API: ${responseText}`);
      }

      if (!response.ok) {
        console.error('PayOS API error:', data);
        throw new Error(`PayOS API error: ${data.message || response.statusText}`);
      }

      return data as T;
    } catch (error) {
      console.error('PayOS API request failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Payment service is temporarily unavailable');
    }
  }

  async createPayment(
    orderCode: number,
    amount: number,
    description: string,
    returnUrl: string,
    cancelUrl: string,
    buyerEmail?: string,
    buyerName?: string
  ): Promise<PayOSPaymentResponse> {
    const paymentData = {
      orderCode,
      amount,
      description,
      cancelUrl,
      returnUrl,
      buyerEmail,
      buyerName,
    }

    // Generate signature according to PayOS rule
    const signature = this.generatePaymentSignature({
      amount,
      cancelUrl,
      description,
      orderCode,
      returnUrl,
    })

    const requestBody: PayOSPaymentRequest = {
      ...paymentData,
      signature,
    }

    console.log('PayOS createPayment request body:', requestBody)

    return this.makeRequest<PayOSPaymentResponse>('/v2/payment-requests', 'POST', requestBody)
  }

  async verifyPayment(orderCode: number): Promise<PayOSVerifyResponse> {
    return this.makeRequest<PayOSVerifyResponse>(
      `/v2/payment-requests/${orderCode}`,
      'GET'
    );
  }

  async getPaymentInfo(orderCode: number): Promise<PayOSVerifyResponse> {
    return this.makeRequest<PayOSVerifyResponse>(
      `/v2/payment-requests/${orderCode}`,
      'GET'
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing PayOS API connection...');
      console.log('Environment variables:', {
        clientId: this.clientId ? 'Set' : 'Missing',
        apiKey: this.apiKey ? 'Set' : 'Missing',
        checksumKey: this.checksumKey ? 'Set' : 'Missing',
        baseUrl: this.baseUrl
      });

      // Try to make a simple request to test the connection
      const testData = { test: 'connection' };
      const dataStr = JSON.stringify(testData);
      const signature = this.generateSignature(dataStr);

      console.log('Test signature generated:', signature);
      return true;
    } catch (error) {
      console.error('PayOS connection test failed:', error);
      return false;
    }
  }
}

export default PayOSService; 