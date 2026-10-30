import React, { useState } from 'react';
import { db } from '../lib/db';
import { useShop } from '../context/ShopContext';
import { Phone, Mail, User, MapPin, Send, CheckCircle2, MessageSquare } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const { config, showToast } = useShop();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      showToast('Please provide your name, phone number, and message.');
      return;
    }

    db.submitContactMessage({
      name,
      email,
      phone,
      subject: subject || 'General Customer Enquiry',
      message,
    });

    setSubmitted(true);
    showToast('Your message has been received!');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-200">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-xs font-bold uppercase tracking-widest text-[#2e5e43]">
          Reach Our Founders
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 mb-2">
          Contact KVN TEAPOWDER
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          Have a question about our tea leaf selections, South Indian filter coffee blends, wholesale hotel distribution, or village delivery? Get in touch directly with Kavinash.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Business details card */}
        <div className="md:col-span-5 space-y-4">
          <div className="bg-[#143728] text-white rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-bold font-serif-brand text-amber-200">
                KVN TEAPOWDER
              </h3>
              <p className="text-xs text-stone-300 mt-1">
                Quality Tea & Coffee Powders for Every Home
              </p>
            </div>

            <div className="space-y-4 text-xs text-stone-200">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Owner & Operator</div>
                  <div className="text-sm font-bold text-amber-200 uppercase">{config?.owner || 'Kavinash'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Direct Phone Numbers</div>
                  <a href={`tel:${config?.primaryPhone || '6383050287'}`} className="block hover:underline text-sm font-medium">
                    +91 {config?.primaryPhone || '6383050287'} (Primary)
                  </a>
                  <a href={`tel:${config?.secondaryPhone || '9787513911'}`} className="block hover:underline text-stone-300">
                    +91 {config?.secondaryPhone || '9787513911'} (Additional)
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Official Business Email</div>
                  <a href={`mailto:${config?.email || 'kvnteapowder@gmail.com'}`} className="hover:underline break-all text-stone-300">
                    {config?.email || 'kvnteapowder@gmail.com'}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Operating Region</div>
                  <div className="text-stone-300">
                    Local Villages & Towns, Tamil Nadu, India.
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#2a5940]">
              <a
                href={`https://wa.me/91${config.primaryPhone}?text=Hello%20Kavinash,%20I%20have%20an%20enquiry%20regarding%20KVN%20TEAPOWDER.`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[#25D366] text-white font-semibold text-xs rounded-xl hover:bg-[#20ba59] transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                Instant WhatsApp Chat
              </a>
            </div>
          </div>

          {/* Official documentation note */}
          <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 text-[11px] text-stone-600">
            <strong className="text-stone-800 block mb-1">Business Verification & Documentation:</strong>
            For bulk business purchases, institutional invoicing, or legitimate regulatory verification requests, kindly email us directly at <strong>{config.email}</strong>.
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
          {submitted ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Message Sent Successfully!</h3>
              <p className="text-xs text-stone-600 max-w-sm mx-auto mb-6">
                Your message has been delivered to <strong>{config.email}</strong> and registered in our communications inbox. Kavinash will respond shortly.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setSubject('');
                  setMessage('');
                }}
                className="px-5 py-2 bg-[#143728] text-white text-xs font-semibold rounded-xl hover:bg-[#204e37]"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-bold text-stone-900 text-base">
                Send an Online Inquiry
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Senthil Nathan"
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
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
                    placeholder="10-digit phone"
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
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
                    placeholder="name@gmail.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Hotel Dust Tea Wholesale Enquiry"
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Your Message or Requirement *
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about the quantity you need, your village or town location, or any specific questions..."
                  className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#143728] text-white font-bold text-xs rounded-xl hover:bg-[#204e37] transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <Send className="w-4 h-4" /> Send Enquiry to Kavinash
              </button>

              <p className="text-[11px] text-stone-400 text-center">
                All submissions automatically dispatch an alert to <strong>{config.email}</strong>.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
