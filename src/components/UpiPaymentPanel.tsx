import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Smartphone,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { Order } from '../types';
import { api } from '../lib/api';
import { useShop } from '../context/ShopContext';

interface UpiPaymentPanelProps {
  order: Order;
  onOrderUpdated: (updated: Order) => void;
}

/**
 * Compresses an uploaded payment screenshot image below ~100KB JPEG
 * so submission stays fast and never triggers request-too-large errors.
 */
function compressScreenshot(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Unable to read image file'));
    reader.readAsDataURL(file);
  });
}

export const UpiPaymentPanel: React.FC<UpiPaymentPanelProps> = ({ order, onOrderUpdated }) => {
  const { config, showToast } = useShop();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Payment submission form state
  const [utrInput, setUtrInput] = useState(order.paymentDetails?.utr || '');
  const [payerNameInput, setPayerNameInput] = useState(order.paymentDetails?.submittedPayerName || '');
  const [screenshotUrl, setScreenshotUrl] = useState(order.paymentDetails?.paymentScreenshotUrl || '');
  const [uploadingShot, setUploadingShot] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [allowResubmit, setAllowResubmit] = useState(false);

  const upiInfo = order.upiPaymentInfo;
  const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'Paid';
  const isRejected = order.paymentStatus === 'REJECTED' || order.paymentStatus === 'Failed';
  const hasSubmittedUtr = Boolean(order.paymentDetails?.utr);

  useEffect(() => {
    let cancelled = false;
    if (upiInfo?.configured && upiInfo.upiUri && !isPaid) {
      QRCode.toDataURL(upiInfo.upiUri, {
        width: 260,
        margin: 2,
        color: { dark: '#143728', light: '#ffffff' },
      })
        .then((url) => {
          if (!cancelled) setQrDataUrl(url);
        })
        .catch(() => {
          if (!cancelled) setQrDataUrl('');
        });
    } else {
      setQrDataUrl('');
    }
    return () => {
      cancelled = true;
    };
  }, [upiInfo?.configured, upiInfo?.upiUri, isPaid]);

  const handleCopyUpi = () => {
    if (!upiInfo?.upiId) return;
    navigator.clipboard.writeText(upiInfo.upiId);
    setCopiedUpi(true);
    showToast('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleScreenshotSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError('');
    setUploadingShot(true);
    try {
      const signRes: { configured: boolean; cloudName?: string; apiKey?: string; timestamp?: number; folder?: string; signature?: string; message?: string } = await api.getPaymentCloudinarySignature().catch(() => ({ configured: false }));
      if (
        signRes.configured &&
        signRes.cloudName &&
        signRes.apiKey &&
        signRes.timestamp &&
        signRes.folder &&
        signRes.signature
      ) {
        const uploaded = await api.uploadToCloudinary(file, {
          cloudName: signRes.cloudName,
          apiKey: signRes.apiKey,
          timestamp: signRes.timestamp,
          folder: signRes.folder,
          signature: signRes.signature,
        });
        setScreenshotUrl(uploaded.secure_url);
      } else {
        const compressed = await compressScreenshot(file);
        if (compressed.length > 180000) {
          throw new Error('Screenshot too large even after compression. Please use a clearer smaller crop.');
        }
        setScreenshotUrl(compressed);
      }
      showToast('Payment screenshot attached');
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not attach payment screenshot');
    } finally {
      setUploadingShot(false);
    }
  };

  const handleSubmitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessNotice('');

    const cleanUtr = utrInput.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      setSubmitError('Please enter your valid UPI Transaction ID / UTR (at least 6 characters).');
      return;
    }

    setSubmittingProof(true);
    try {
      const res = await api.submitOrderPayment(order.id, {
        utr: cleanUtr,
        submittedPayerName: payerNameInput.trim() || undefined,
        paymentScreenshotUrl: screenshotUrl || undefined,
      });
      setSuccessNotice(res.message);
      setAllowResubmit(false);
      onOrderUpdated(res.order);
      showToast('Payment details submitted for verification!');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit payment details. Please check your UTR and try again.');
    } finally {
      setSubmittingProof(false);
    }
  };

  const buildAppUri = (scheme: string) => {
    if (!upiInfo?.upiUri) return '#';
    return upiInfo.upiUri.replace('upi://pay?', `${scheme}?`);
  };

  // 1. VERIFIED STATE
  if (isPaid) {
    const waStatus = (order.whatsappStatus || '').toLowerCase();
    return (
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 sm:p-6 space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-emerald-950 tracking-wide">
                PAYMENT VERIFIED ✓
              </div>
              <div className="text-xs font-bold text-emerald-800">ORDER CONFIRMED ✓</div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-[11px] font-bold">
            PAID • ₹{order.paymentDetails?.verifiedAmount ?? order.totalAmount}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/80 rounded-xl p-4 border border-emerald-200 text-xs">
          <div>
            <span className="text-stone-500 block">Customer Name</span>
            <span className="font-bold text-stone-900">{order.customer.fullName}</span>
          </div>
          <div>
            <span className="text-stone-500 block">Order Reference</span>
            <span className="font-bold text-stone-900">{order.orderNumber}</span>
          </div>
          <div>
            <span className="text-stone-500 block">Verified Amount</span>
            <span className="font-bold text-emerald-800">₹{order.paymentDetails?.verifiedAmount ?? order.totalAmount}</span>
          </div>
          <div>
            <span className="text-stone-500 block">Payment Verification Time</span>
            <span className="font-semibold text-stone-900">
              {order.paymentDetails?.verifiedAt
                ? new Date(order.paymentDetails.verifiedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Verified'}
            </span>
          </div>
          {order.paymentDetails?.utrNormalized && (
            <div>
              <span className="text-stone-500 block">Verified UTR Ref</span>
              <span className="font-mono font-bold text-stone-800">{order.paymentDetails.utrNormalized}</span>
            </div>
          )}
          {order.paymentDetails?.verifiedPayerName && (
            <div>
              <span className="text-stone-500 block">Verified Payer Name</span>
              <span className="font-semibold text-stone-900">{order.paymentDetails.verifiedPayerName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-emerald-900 pt-1">
          <div className="flex items-center gap-1.5 font-medium">
            <MessageCircle className="w-4 h-4 text-emerald-700" />
            <span>
              WhatsApp Confirmation:{' '}
              <strong>
                {waStatus === 'sent'
                  ? 'Sent to your mobile ✓'
                  : waStatus === 'opted_out'
                  ? 'Opted out'
                  : 'Queued by KVN Tea Powder'}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-emerald-700">Live updates active</span>
        </div>
      </div>
    );
  }

  // 2. REJECTED STATE
  if (isRejected && !allowResubmit) {
    return (
      <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 sm:p-6 space-y-4 text-left">
        <div className="flex items-start gap-3">
          <XCircle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-extrabold text-rose-950">PAYMENT VERIFICATION REJECTED</div>
            <p className="text-xs text-rose-800 mt-1">
              {order.paymentDetails?.rejectionReason ||
                'Your submitted payment reference could not be verified in our bank records.'}
            </p>
            {order.paymentDetails?.utrNormalized && (
              <p className="text-[11px] text-rose-700 mt-1 font-mono">
                Submitted UTR: {order.paymentDetails.utrNormalized}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/91${config.primaryPhone || '6383050287'}?text=${encodeURIComponent(
              `Hello KVN Tea Powder, my payment for Order ${order.orderNumber} needs review. Please assist.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#20ba59]"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Contact Support (+91 {config.primaryPhone || '6383050287'})
          </a>
        </div>
      </div>
    );
  }

  // Only show UPI QR + submission for ONLINE_UPI orders
  if (order.paymentMethod !== 'ONLINE_UPI') {
    return null;
  }

  return (
    <div className="space-y-5 text-left">
      {/* 3. SUBMITTED & WAITING VERIFICATION BANNER */}
      {hasSubmittedUtr && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
              <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
              <span>PAYMENT VERIFICATION PENDING</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[10px] font-bold">
              Auto-updating live
            </span>
          </div>

          <p className="text-xs text-amber-900 leading-relaxed">
            {successNotice ||
              'Your payment details have been submitted. We are verifying your transaction. You will receive a confirmation message once your payment is verified.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white/80 p-3 rounded-xl border border-amber-200 text-xs">
            <div>
              <span className="text-[10px] uppercase text-stone-500 block font-bold">Submitted UTR</span>
              <span className="font-mono font-bold text-stone-900">{order.paymentDetails?.utrNormalized}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-stone-500 block font-bold">Payer Name</span>
              <span className="font-semibold text-stone-800">
                {order.paymentDetails?.submittedPayerName || 'Not specified'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-stone-500 block font-bold">Submitted At</span>
              <span className="text-stone-700">
                {order.paymentDetails?.paymentSubmittedAt
                  ? new Date(order.paymentDetails.paymentSubmittedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Just now'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAllowResubmit(!allowResubmit)}
            className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-700 cursor-pointer"
          >
            {allowResubmit ? 'Hide UTR edit form' : 'Need to correct UTR or upload screenshot?'}
          </button>
        </div>
      )}

      {/* 4. DYNAMIC UPI QR + UTR SUBMISSION FORM */}
      {(!hasSubmittedUtr || allowResubmit) && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#143728]" />
                Direct UPI Payment — Pay ₹{order.totalAmount}
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Server-locked payable total • Zero convenience fee
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold">
              PAYMENT_PENDING
            </span>
          </div>

          {!upiInfo?.configured || !upiInfo?.upiUri ? (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">Admin Configuration Warning: UPI ID Not Configured</div>
                <p>
                  {upiInfo?.warning ||
                    'The store owner has not configured a valid UPI ID in Admin Settings yet. No payment QR can be generated until configured.'}
                </p>
                <p className="text-[11px] text-rose-800">
                  Need help? Contact Kavinash at +91 {config.primaryPhone || '6383050287'}.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left: Dynamic QR + Deep Links + Copy UPI */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 text-center space-y-3">
                <div className="text-xs font-bold text-[#143728]">
                  Scan & Pay Exact ₹{order.totalAmount}
                </div>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`UPI Payment QR for ${order.orderNumber}`}
                    className="w-52 h-52 mx-auto rounded-xl border border-stone-200 p-2 bg-white"
                  />
                ) : (
                  <div className="w-52 h-52 mx-auto flex items-center justify-center bg-stone-100 rounded-xl text-xs text-stone-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-1" /> Generating QR...
                  </div>
                )}

                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between gap-2 text-xs">
                  <div className="text-left min-w-0">
                    <div className="text-[10px] text-stone-500">UPI ID ({upiInfo.merchantName})</div>
                    <div className="font-mono font-bold text-stone-900 truncate">{upiInfo.upiId}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-2.5 py-1.5 bg-[#143728] text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-[#204e37] shrink-0 cursor-pointer"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUpi ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Supported UPI Apps Deep Links */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Pay on Mobile UPI App
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <a
                      href={buildAppUri('tez://upi/pay')}
                      className="px-3 py-2 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 inline-flex items-center justify-center gap-1"
                    >
                      <Smartphone className="w-3.5 h-3.5" /> Google Pay
                    </a>
                    <a
                      href={buildAppUri('phonepe://pay')}
                      className="px-3 py-2 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl font-bold hover:bg-purple-100 inline-flex items-center justify-center gap-1"
                    >
                      <Smartphone className="w-3.5 h-3.5" /> PhonePe
                    </a>
                    <a
                      href={buildAppUri('paytmmp://pay')}
                      className="px-3 py-2 bg-sky-50 text-sky-800 border border-sky-200 rounded-xl font-bold hover:bg-sky-100 inline-flex items-center justify-center gap-1"
                    >
                      <Smartphone className="w-3.5 h-3.5" /> Paytm
                    </a>
                    <a
                      href={upiInfo.upiUri}
                      className="px-3 py-2 bg-emerald-50 text-[#143728] border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 inline-flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Any UPI App
                    </a>
                  </div>
                </div>

                <div className="text-[10px] text-stone-500 bg-stone-50 rounded-lg p-2 border border-stone-100 text-left space-y-0.5">
                  <div>
                    <strong>Txn Ref:</strong> <span className="font-mono">{upiInfo.transactionRef}</span>
                  </div>
                  <div>
                    <strong>Note:</strong> {upiInfo.transactionNote}
                  </div>
                </div>
              </div>

              {/* Right: Customer Payment Proof Form */}
              <form onSubmit={handleSubmitPaymentProof} className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#143728]">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Step 2: Submit Payment Proof (Required)</span>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  After paying ₹{order.totalAmount} in GPay / PhonePe / Paytm, enter your UPI Transaction ID (UTR) below so our team can verify and confirm your order.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    UPI Transaction ID / UTR Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    placeholder="e.g. 431512345678"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono uppercase focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Actual Payer Name <span className="text-stone-400 font-normal">(If known / paid from another account)</span>
                  </label>
                  <input
                    type="text"
                    value={payerNameInput}
                    onChange={(e) => setPayerNameInput(e.target.value)}
                    placeholder="e.g. Account holder name in GPay"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Payment Screenshot <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="px-3.5 py-2 bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-200 cursor-pointer inline-flex items-center gap-1.5">
                      {uploadingShot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingShot ? 'Attaching...' : screenshotUrl ? 'Change Screenshot' : 'Upload Screenshot'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotSelect}
                        disabled={uploadingShot}
                        className="hidden"
                      />
                    </label>
                    {screenshotUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={screenshotUrl}
                          alt="Payment proof"
                          className="w-10 h-10 object-cover rounded-lg border border-stone-300"
                        />
                        <button
                          type="button"
                          onClick={() => setScreenshotUrl('')}
                          className="text-[11px] text-rose-600 font-semibold hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingProof || uploadingShot}
                  className="w-full py-3 bg-[#143728] text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-[#204e37] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submittingProof ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting Proof...
                    </>
                  ) : (
                    'Submit Payment Details for Verification'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
