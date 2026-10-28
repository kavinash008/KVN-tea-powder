import { Order } from '../../src/types';

export interface ExcelSyncResult {
  success: boolean;
  status: 'synced' | 'failed' | 'not_configured';
  error?: string;
  syncedAt?: string;
}

export class ExcelSyncService {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private driveId: string;
  private fileId: string;
  private tableName: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.tenantId = (process.env.MS_GRAPH_TENANT_ID || '').trim();
    this.clientId = (process.env.MS_GRAPH_CLIENT_ID || '').trim();
    this.clientSecret = (process.env.MS_GRAPH_CLIENT_SECRET || '').trim();
    this.driveId = (process.env.MS_EXCEL_DRIVE_ID || '').trim();
    this.fileId = (process.env.MS_EXCEL_FILE_ID || '').trim();
    this.tableName = (process.env.MS_EXCEL_TABLE_NAME || 'OrdersTable').trim();
  }

  public isConfigured(): boolean {
    return Boolean(
      this.tenantId &&
      this.clientId &&
      this.clientSecret &&
      this.driveId &&
      this.fileId
    );
  }

  public getConfigurationStatus() {
    return {
      configured: this.isConfigured(),
      tenantConfigured: Boolean(this.tenantId),
      clientConfigured: Boolean(this.clientId),
      secretConfigured: Boolean(this.clientSecret),
      driveConfigured: Boolean(this.driveId),
      fileConfigured: Boolean(this.fileId),
      tableName: this.tableName,
    };
  }

  /**
   * Acquire a valid Microsoft Graph OAuth 2.0 app-only access token.
   */
  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'https://graph.microsoft.com/.default');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to acquire Microsoft Graph token: ${response.status} ${errText}`);
    }

    const data = await response.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return this.cachedToken!;
  }

  /**
   * Format order into the recommended columns:
   * Order ID, Order Date, Customer ID, Customer Name, Email, Phone, Product Summary, Quantities,
   * Subtotal, Delivery Charge, Total, Payment Method, Payment Status, Order Status,
   * Recipient Name, Delivery Phone, Address, City, State, PIN Code, WhatsApp Status, Excel Sync Status
   */
  public buildOrderRowValues(order: Order): any[] {
    const productSummary = (order.items || [])
      .map((item) => `${item.productName} (${item.weight})`)
      .join('; ');

    const quantitiesSummary = (order.items || [])
      .map((item) => `${item.productName}: ${item.quantity}`)
      .join('; ');

    const orderId = order.orderNumber || order.id;
    const recipientName = order.customer.fullName || 'Valued Customer';
    const deliveryPhone = order.customer.phone || '';
    const email = order.customer.email || 'N/A';
    const address = order.customer.address || '';
    const city = order.customer.villageTown || '';
    const state = order.customer.state || 'Tamil Nadu';
    const pincode = order.customer.pincode || '';

    return [
      orderId,
      order.createdAt,
      order.customerId || 'GUEST',
      recipientName,
      email,
      deliveryPhone,
      productSummary,
      quantitiesSummary,
      order.subtotal,
      order.deliveryCharge,
      order.totalAmount,
      order.paymentMethod,
      order.paymentStatus,
      order.orderStatus,
      recipientName,
      deliveryPhone,
      address,
      city,
      state,
      pincode,
      order.whatsappStatus || 'pending',
      'synced',
    ];
  }

  /**
   * Append the order row to the configured Excel table in OneDrive/SharePoint.
   * Performs idempotency check using Microsoft Graph API to prevent duplicate rows.
   */
  public async syncOrderToExcel(order: Order): Promise<ExcelSyncResult> {
    const now = new Date().toISOString();
    const orderId = order.orderNumber || order.id;

    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'not_configured',
        error: 'Microsoft Graph Excel credentials not configured (tenant, client ID, client secret, drive ID or file ID missing)',
      };
    }

    try {
      const accessToken = await this.getAccessToken();

      // Table rows endpoint
      const tableRowsUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${encodeURIComponent(this.tableName)}/rows`;

      // 1. Idempotency Check: Query existing rows in table to see if orderId is already present
      try {
        const existingRowsRes = await fetch(tableRowsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (existingRowsRes.ok) {
          const existingData = await existingRowsRes.json();
          const rows = existingData?.value || [];
          const exists = rows.some((row: any) => {
            const rowValues = row.values?.[0] || [];
            return rowValues[0] === orderId;
          });

          if (exists) {
            return {
              success: true,
              status: 'synced',
              syncedAt: now,
            };
          }
        }
      } catch (checkErr) {
        console.warn(`Excel idempotency check warning for order ${orderId}:`, checkErr);
      }

      // 2. Append row to Excel table
      const rowValues = this.buildOrderRowValues(order);
      const appendResponse = await fetch(`${tableRowsUrl}/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowValues],
        }),
      });

      if (!appendResponse.ok) {
        const errText = await appendResponse.text();
        console.warn(`Microsoft Graph Excel row append error for order ${orderId}:`, errText);
        return {
          success: false,
          status: 'failed',
          error: `Graph API Error ${appendResponse.status}: ${errText.slice(0, 200)}`,
        };
      }

      return {
        success: true,
        status: 'synced',
        syncedAt: now,
      };
    } catch (err: any) {
      console.error(`Excel synchronization exception for order ${orderId}:`, err);
      return {
        success: false,
        status: 'failed',
        error: err.message || 'Network error syncing with Microsoft Graph API',
      };
    }
  }
}

export const excelSyncService = new ExcelSyncService();
