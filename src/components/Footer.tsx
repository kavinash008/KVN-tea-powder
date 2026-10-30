import React from 'react';
import { KVNLogo } from './KVNLogo';
import { Phone, Mail, MessageSquare, ArrowUpRight } from 'lucide-react';
import { BusinessConfig } from '../types';
import { useShop } from '../context/ShopContext';
import { INITIAL_BUSINESS_CONFIG } from '../data/initialData';

interface FooterProps {
  config?: BusinessConfig;
  onNavigate: (tab: string) => void;
  onAdminClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ config: propConfig, onNavigate, onAdminClick }) => {
  const shopContext = useShop();
  const config = propConfig || shopContext?.config || INITIAL_BUSINESS_CONFIG;

  const handleAdminTrigger = () => {
    if (onAdminClick) {
      onAdminClick();
    } else {
      onNavigate('admin');
    }
  };

  return (
    <footer className="bg-[#143728] text-stone-300 pt-16 pb-12 border-t border-[#204e37]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-[#24533b]">
          {/* Brand & Overview */}
          <div className="lg:col-span-2 space-y-4">
            <KVNLogo variant="white" size="lg" />
            <p className="text-[#c29958] font-serif-brand italic text-base">
              "Goodness in Every Sip"
            </p>
            <p className="text-stone-300 text-sm leading-relaxed max-w-sm">
              Authentic Indian tea and artisanal coffee powders crafted from carefully chosen Nilgiri leaves and Chikmagalur beans. Dedicated to pure, rich flavor for every household.
            </p>
            <div className="pt-2 flex flex-col gap-1 text-xs text-stone-400">
              <span>Business Proprietor: <strong className="text-white">{config.owner}</strong></span>
              <span>Direct Inquiries: <strong className="text-white">{config.primaryPhone}</strong> / <strong className="text-white">{config.secondaryPhone}</strong></span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-l-2 border-[#c29958] pl-2">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { id: 'home', label: 'Home' },
                { id: 'products', label: 'All Powders' },
                { id: 'tea', label: 'Tea Powders' },
                { id: 'coffee', label: 'Coffee Powders' },
                { id: 'new-arrivals', label: 'New Arrivals' },
                { id: 'about', label: 'About Kavinash' },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onNavigate(item.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#f7e6c4] hover:translate-x-1 transition-all duration-200 text-left cursor-pointer"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care & Feedback */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-l-2 border-[#c29958] pl-2">
              Customer Support
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#c29958] shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <a href={`tel:${config.primaryPhone}`} className="hover:text-white transition-colors">
                    {config.primaryPhone}
                  </a>
                  <a href={`tel:${config.secondaryPhone}`} className="hover:text-white transition-colors text-xs text-stone-400">
                    {config.secondaryPhone}
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#c29958] shrink-0" />
                <a 
                  href={`mailto:${config.email}`} 
                  className="hover:text-white transition-colors text-xs break-all"
                >
                  {config.email}
                </a>
              </li>
              <li className="pt-2">
                <button
                  onClick={() => {
                    onNavigate('feedback');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-200 hover:text-white transition-colors cursor-pointer"
                >
                  Submit Customer Review <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    onNavigate('contact');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-200 hover:text-white transition-colors cursor-pointer"
                >
                  Bulk & Wholesale Inquiry <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </li>
            </ul>
          </div>

          {/* Transparency & Delivery Notice */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-l-2 border-[#c29958] pl-2">
              Policies & Notice
            </h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <button onClick={() => onNavigate('policies')} className="hover:underline cursor-pointer">
                  Privacy Policy & Terms
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('policies')} className="hover:underline cursor-pointer">
                  Shipping & Village Delivery
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('policies')} className="hover:underline cursor-pointer">
                  Cancellation & Refund Policy
                </button>
              </li>
              <li className="pt-3 text-[11px] text-stone-400 leading-normal border-t border-[#24533b]">
                <span className="font-semibold text-stone-300 block mb-1">Authentic Guarantee:</span>
                Direct small-batch tea & coffee packaging in Tamil Nadu. Zero adulteration, 100% natural aroma.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright and WhatsApp assist */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-400 gap-4">
          <p className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} KVN TEAPOWDER. All rights reserved.</span>
            {/* Discreet portal link for owner only - invisible to normal customers */}
            <span
              onClick={handleAdminTrigger}
              className="opacity-20 hover:opacity-100 transition-opacity cursor-pointer text-stone-400"
              title="Portal"
            >
              🔒
            </span>
          </p>
          <div className="flex items-center gap-4">
            <a
              href={`https://wa.me/91${config.primaryPhone}?text=Hello%20KVN%20TEAPOWDER`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#25D366] text-white px-3.5 py-1.5 rounded-full font-medium shadow-xs hover:bg-[#20ba59] active:scale-95 transition-all text-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
