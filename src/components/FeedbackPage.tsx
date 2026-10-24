import React, { useState } from 'react';
import { db } from '../lib/db';
import { useShop } from '../context/ShopContext';
import { Star, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';

export const FeedbackPage: React.FC = () => {
  const { config, showToast } = useShop();
  const products = db.getProducts();

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState('');
  const [productId, setProductId] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Fetch approved public reviews (Only approved reviews appear publicly, respecting intent)
  const approvedReviews = db.getFeedback().filter((f) => f.status === 'Approved');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !message.trim()) {
      showToast('Please fill in your name, mobile, and feedback.');
      return;
    }

    const selectedProd = products.find((p) => p.id === productId);

    db.submitFeedback({
      customerName,
      phone,
      email,
      orderId,
      productId: productId || undefined,
      productName: selectedProd ? selectedProd.name : undefined,
      rating,
      message,
    });

    setSubmitted(true);
    showToast('Thank you for your feedback!');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-200">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2e5e43]">
          Customer Experiences
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 mb-2">
          Your Feedback Matters to Krishnamoorthy
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          We pride ourselves on fresh aroma, brisk strength, and pure taste. Share your experience with KVN TEAPOWDER or suggest how we can serve your family better.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Feedback Submission Form */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
          {submitted ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                Thank you for your feedback!
              </h3>
              <p className="text-xs text-stone-600 max-w-sm mx-auto mb-6">
                Your review has been securely submitted and sent to <strong>{config.email}</strong>. Our team will review and publish it shortly.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setMessage('');
                  setOrderId('');
                }}
                className="px-5 py-2 bg-[#143728] text-white text-xs font-semibold rounded-xl hover:bg-[#204e37]"
              >
                Submit Another Review
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-bold text-stone-900 text-base mb-1">
                Write a Review
              </h3>

              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Rating:
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 focus:outline-hidden transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          (hoverRating || rating) >= star
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-semibold text-stone-600 ml-2">
                    {rating} of 5 Stars
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Anand S"
                    className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit number"
                    className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Order ID <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="KVN-2026-..."
                    className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Select Product <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                >
                  <option value="">General Brand Experience</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Your Review / Message *
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How was the decoction color, aroma, or taste? Did you enjoy it with milk?"
                  className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all shadow-xs"
                >
                  Submit Feedback
                </button>
              </div>

              <p className="text-[11px] text-stone-400 text-center">
                Submissions are reviewed by admin to maintain high quality and prevent spam.
              </p>
            </form>
          )}
        </div>

        {/* Public Reviews List */}
        <div className="md:col-span-5 space-y-4">
          <h3 className="font-bold text-stone-900 text-base flex items-center justify-between">
            <span>Approved Customer Reviews</span>
            <span className="text-xs text-stone-500 font-normal">
              ({approvedReviews.length})
            </span>
          </h3>

          {approvedReviews.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-stone-200/80 text-center">
              <MessageSquare className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h4 className="font-semibold text-stone-800 text-sm">No reviews yet.</h4>
              <p className="text-xs text-stone-500 mt-1">
                Be the first to review KVN TEAPOWDER and tell fellow tea lovers about our quality!
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {approvedReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-900 text-xs">
                      {rev.customerName}
                    </span>
                    <div className="flex items-center text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  {rev.productName && (
                    <div className="text-[11px] text-[#2e5e43] font-medium">
                      Reviewed: {rev.productName}
                    </div>
                  )}

                  <p className="text-xs text-stone-600 italic">
                    "{rev.message}"
                  </p>

                  <div className="text-[10px] text-stone-400 text-right">
                    {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
