import { Order } from '../../src/types';

export interface WhatsAppSendResult {
  success: boolean;
  status: 'sent' | 'failed' | 'not_configured';
  messageId?: string;
  error?: string;
  sentAt?: string;
}

export class WhatsAppService {
  private phoneNumberId: string;
  private accessToken: string;
  private templateName: string;

  constructor() {
    this.phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    this.accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    this.templateName = (process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  }

  public isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  /**
   * Normalize an Indian phone number to E.164 format without leading '+'
   * (e.g. 9787513911 -> 919787513911)
   */
  public normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return digits;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `91${digits.slice(1)}`;
    }
    return digits;
  }

  /**
   * Send WhatsApp order confirmation message via Meta WhatsApp Business Cloud API.
   * If credentials are not configured, gracefully logs and records 'not_configured'.
   */
  public async sendOrderConfirmation(order: Order): Promise<WhatsAppSendResult> {
    const now = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'not_configured',
        error: 'WhatsApp Business Cloud API credentials not configured (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing)',
      };
    }

    const recipientPhone = this.normalizePhone(order.customer.phone);
    if (!recipientPhone || recipientPhone.length < 10) {
      return {
        success: false,
        status: 'failed',
        error: `Invalid customer phone number: ${order.customer.phone}`,
      };
    }

    const shortAddress = `${order.customer.address}, ${order.customer.villageTown} - ${order.customer.pincode}`;
    const orderId = order.orderNumber || order.id;
    const total = order.totalAmount;

    const messageText = `Thank you for ordering from KVN Tea Powder! Your order has been placed successfully.\n\nOrder ID: ${orderId}\nOrder Total: ₹${total}\nDelivery Address: ${shortAddress}\n\nWe will update you when your order status changes.`;

    const apiUrl = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;

    // If template is configured, use official WhatsApp template; otherwise use text payload
    const payload = this.templateName
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'template',
          template: {
            name: this.templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: orderId },
                  { type: 'text', text: String(total) },
                  { type: 'text', text: shortAddress },
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
            body: messageText,
          },
        };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorDetail = responseData?.error?.message || responseData?.error?.error_data?.details || `HTTP ${response.status}`;
        console.warn(`WhatsApp Cloud API error for order ${orderId}:`, errorDetail);
        return {
          success: false,
          status: 'failed',
          error: errorDetail,
        };
      }

      const messageId = responseData?.messages?.[0]?.id;
      return {
        success: true,
        status: 'sent',
        messageId,
        sentAt: now,
      };
    } catch (err: any) {
      console.error(`WhatsApp dispatch network exception for order ${orderId}:`, err);
      return {
        success: false,
        status: 'failed',
        error: err.message || 'Network error communicating with WhatsApp Cloud API',
      };
    }
  }
}

export const whatsappService = new WhatsAppService();
