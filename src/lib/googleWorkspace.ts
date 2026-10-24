// Helper for Google Workspace integrations (OAuth GSI client token based)
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send'
];

let gAccessToken: string | null = null;
let tokenExpiration: number = 0;

export function getStoredToken(): string | null {
  if (gAccessToken && Date.now() < tokenExpiration) {
    return gAccessToken;
  }
  const saved = localStorage.getItem('kvn_google_access_token');
  const exp = localStorage.getItem('kvn_google_token_exp');
  if (saved && exp && Date.now() < parseInt(exp, 10)) {
    gAccessToken = saved;
    tokenExpiration = parseInt(exp, 10);
    return saved;
  }
  return null;
}

export function saveToken(token: string, expiresInSeconds: number = 3600) {
  gAccessToken = token;
  tokenExpiration = Date.now() + (expiresInSeconds - 60) * 1000;
  localStorage.setItem('kvn_google_access_token', token);
  localStorage.setItem('kvn_google_token_exp', tokenExpiration.toString());
}

export function clearToken() {
  gAccessToken = null;
  tokenExpiration = 0;
  localStorage.removeItem('kvn_google_access_token');
  localStorage.removeItem('kvn_google_token_exp');
}

export async function requestGoogleToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if token already exists and valid
    const existing = getStoredToken();
    if (existing) {
      return resolve(existing);
    }

    // @ts-ignore
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      return reject(new Error('Google Identity Services script not yet loaded. Please refresh or check connection.'));
    }

    try {
      // @ts-ignore
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: '', // Handled by AI Studio proxy container or prompt
        scope: OAUTH_SCOPES.join(' '),
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else if (response.access_token) {
            saveToken(response.access_token, response.expires_in || 3600);
            resolve(response.access_token);
          } else {
            reject(new Error('No token returned from Google authentication'));
          }
        },
      });
      client.requestAccessToken();
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Send an email notification via Gmail API
 */
export async function sendGmailNotification({
  to,
  subject,
  bodyHtml,
}: {
  to: string;
  subject: string;
  bodyHtml: string;
}): Promise<boolean> {
  const token = getStoredToken();
  if (!token) {
    console.warn('Google Workspace token not connected. Gmail notification skipped for:', subject);
    return false;
  }

  try {
    const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      bodyHtml,
    ];
    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Failed to send Gmail message:', err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error invoking Gmail API:', error);
    return false;
  }
}

/**
 * Append an order row to Google Sheet
 */
export async function appendOrderToGoogleSheet(
  spreadsheetId: string,
  orderData: any[]
): Promise<boolean> {
  const token = getStoredToken();
  if (!token || !spreadsheetId) {
    return false;
  }

  try {
    const range = 'Orders!A:M';
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [orderData],
        }),
      }
    );

    return response.ok;
  } catch (err) {
    console.error('Failed to append to Google Sheet:', err);
    return false;
  }
}
