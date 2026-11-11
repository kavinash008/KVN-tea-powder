import { Order } from '../../src/types';

export interface WhatsAppSendResult {
  success: boolean;
  status: 'Sent' | 'Failed' | 'Pending';
  reason?: string;
  messageId?: string;
  error?: string;
  sentAt?: string;
  attempts: number;
  messagePreview: string;
}

export interface WhatsAppConfigDiagnostics {
  configured: boolean;
  hasPhoneNumberId: boolean;
  hasAccessToken: boolean;
  hasBusinessAccountId: boolean;
  hasTemplateName: boolean;
  templateName: string;
  apiVersion: string;
  phoneNumberIdMasked: string;
}

export class WhatsAppService {
  private getEnvConfig() {
    const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const businessAccountId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();
    const templateName = (process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
    const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v21.0').trim() || 'v21.0';
    return {
      phoneNumberId,
      accessToken,
      businessAccountId,
      templateName,
      apiVersion,
    };
  }

  public isConfigured(): boolean {
    const cfg = this.getEnvConfig();
    return Boolean(cfg.phoneNumberId && cfg.accessToken);
  }

  public getConfigDiagnostics(): WhatsAppConfigDiagnostics {
    const cfg = this.getEnvConfig();
    const masked =
      cfg.phoneNumberId.length > 4
        ? `${'*'.repeat(cfg.phoneNumberId.length - 4)}${cfg.phoneNumberId.slice(-4)}`
        : cfg.phoneNumberId
        ? 'Configured'
        : 'Not Set';
    return {
      configured: Boolean(cfg.phoneNumberId && cfg.accessToken),
      hasPhoneNumberId: Boolean(cfg.phoneNumberId),
      hasAccessToken: Boolean(cfg.accessToken),
      hasBusinessAccountId: Boolean(cfg.businessAccountId),
      hasTemplateName: Boolean(cfg.templateName),
      templateName: cfg.templateName || 'Not Set (Text Message Mode)',
      apiVersion: cfg.apiVersion,
      phoneNumberIdMasked: masked,
    };
  }

  /**
   * Normalize phone number to digits-only E.164 (e.g. +91 9842112345 -> 919842112345)
   */
  public normalizePhone(phone: string, countryCode?: string): string {
    const clean = (phone || '').trim();
    if (clean.startsWith('+')) {
      return clean.replace(/\D/g, '');
    }
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 10) {
      const codeDigits = (countryCode || '91').replace(/\D/g, '') || '91';
      return `${codeDigits}${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `91${digits.slice(1)}`;
    }
    return digits;
  }

  /**
   * Build the exact formatted WhatsApp payment verification message and template variables.
   */
  public buildPaymentConfirmationPayload(order: Order): {
    customerName: string;
    orderId: string;
    productName: string;
    quantity: number;
    amount: number;
    messageText: string;
  } {
    const customerName = order.customer.fullName || 'Customer';
    const orderId = order.orderNumber || order.id;
    const totalQuantity = (order.items || []).reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
    const productName =
      order.items && order.items.length > 0
        ? order.items
            .map((item) => {
              const cleanName = item.productName.replace(/\s*[–-]\s*/g, ' ').trim();
              return item.weight ? `${cleanName} – ${item.weight}` : cleanName;
            })
            .join(', ')
        : 'Briar Talayar Single Origin Tea – 500g';
    const amount = Number(order.paymentDetails?.verifiedAmount ?? order.totalAmount ?? 0);

    const messageText =
      `Hello ${customerName}!\n\n` +
      `Your payment has been successfully verified.\n\n` +
      `Thank you for ordering from KVN Tea Powder!\n\n` +
      `Order Details:\n` +
      `Order ID: ${orderId}\n` +
      `Product: ${productName}\n` +
      `Quantity: ${totalQuantity}\n` +
      `Amount Paid: ₹${amount}\n` +
      `Payment Status: VERIFIED ✓\n\n` +
      `Your order is now confirmed.\n\n` +
      `We will notify you when your order is dispatched.\n\n` +
      `Thank you for choosing KVN Tea Powder!`;

    return {
      customerName,
      orderId,
      productName,
      quantity: totalQuantity,
      amount,
      messageText,
    };
  }

  /**
   * Send payment-verified WhatsApp confirmation via official Meta WhatsApp Business Cloud API.
   * Retries temporary network / 5xx / 429 failures up to 3 total attempts safely.
   */
  public async sendPaymentVerifiedNotification(order: Order): Promise<WhatsAppSendResult> {
    const cfg = this.getEnvConfig();
    const msgData = this.buildPaymentConfirmationPayload(order);

    if (!cfg.phoneNumberId || !cfg.accessToken) {
      return {
        success: false,
        status: 'Pending',
        reason: 'not_configured',
        error: 'WhatsApp Business Cloud API credentials are not configured (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing).',
        attempts: 0,
        messagePreview: msgData.messageText,
      };
    }

    const rawPhone = order.customer.fullPhone || order.customer.phone;
    const recipientPhone = this.normalizePhone(rawPhone, order.customer.countryCode);
    if (!recipientPhone || recipientPhone.length < 10) {
      return {
        success: false,
        status: 'Failed',
        reason: 'invalid_phone',
        error: `Invalid customer mobile number: ${rawPhone}`,
        attempts: 1,
        messagePreview: msgData.messageText,
      };
    }

    const apiUrl = `https://graph.facebook.com/${encodeURIComponent(cfg.apiVersion)}/${encodeURIComponent(cfg.phoneNumberId)}/messages`;

    const payload = cfg.templateName
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'template',
          template: {
            name: cfg.templateName,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: msgData.customerName },
                  { type: 'text', text: msgData.orderId },
                  { type: 'text', text: msgData.productName },
                  { type: 'text', text: String(msgData.quantity) },
                  { type: 'text', text: String(msgData.amount) },
                ],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: msgData.messageText,
          },
        };

    const maxAttempts = 3;
    let lastError = 'Unknown WhatsApp dispatch error';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7500);
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        const responseData = await response.json().catch(() => ({}));

        if (response.ok) {
          const messageId = responseData?.messages?.[0]?.id;
          return {
            success: true,
            status: 'Sent',
            messageId,
            sentAt: new Date().toISOString(),
            attempts: attempt,
            messagePreview: msgData.messageText,
          };
        }

        lastError =
          responseData?.error?.message ||
          responseData?.error?.error_data?.details ||
          `Meta Cloud API HTTP ${response.status}`;

        // Only retry temporary rate-limit or server errors (429 / 5xx)
        if (response.status !== 429 && response.status < 500) {
          console.warn(`WhatsApp Cloud API non-retryable error for ${msgData.orderId}:`, lastError);
          return {
            success: false,
            status: 'Failed',
            reason: `http_${response.status}`,
            error: lastError,
            attempts: attempt,
            messagePreview: msgData.messageText,
          };
        }
      } catch (err: any) {
        lastError = err?.name === 'AbortError' ? 'WhatsApp Cloud API request timed out' : err?.message || 'Network error';
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }

    return {
      success: false,
      status: 'Failed',
      reason: 'api_error',
      error: lastError,
      attempts: maxAttempts,
      messagePreview: msgData.messageText,
    };
  }

  public async sendOrderConfirmation(order: Order): Promise<WhatsAppSendResult> {
    return this.sendPaymentVerifiedNotification(order);
  }
}

export const whatsappService = new WhatsAppService();
