# 🌿 KVN TEAPOWDER — Official Online Store & Admin Portal

> Authentic Nilgiri Tea Blends & Traditional South Indian Filter Coffee Powders. Handcrafted and blended with love in Tamil Nadu by **Krishnamoorthy**.

---

## 🌟 Overview

**KVN TEAPOWDER** is a modern, high-performance, mobile-first e-commerce web application featuring both a customer storefront and a separate, private administration portal.

* **Customer Store**: Browse authentic Nilgiri teas, strong filter coffee blends, and family combos with multiple weight variants (250g, 500g, 1kg), cart drawer, and direct WhatsApp order assistance.
* **Private Admin Portal**: Restricted management dashboard for the owner to add products, adjust prices, manage inventory, view customer orders, and update business settings in real-time.

---

## 🚀 Key Features

### 1. 📱 Ultra-Responsive & Mobile-First
* **Optimized Mobile Header**: Auto-adapts down to 320px screens with zero horizontal overflow or multi-line wrapping.
* **Smart Dropdown Search**: Full-width slide-down search input that never squishes navigation icons.
* **Touch-Friendly Navigation**: Convenient drawer menu with 1-tap thumb access to account, orders, categories, and direct phone/WhatsApp support.

### 2. ⚡ Buttery-Smooth Scroll Transitions (60fps, Zero Lag)
* **Hardware-Accelerated Reveal**: Powered by browser-native `IntersectionObserver` using GPU 3D transforms (`translate3d` and `opacity`).
* **Zero Battery Drain**: Elements unobserve once visible to maintain 0% CPU consumption during scrolling.
* **Dynamic Frosted Header**: Header smoothly morphs into a frosted glass backdrop (`backdrop-blur-md`) with a golden reading progress indicator at the top.
* **Floating Back-to-Top**: Quick floating button that appears after scrolling past 300px for one-tap smooth glide back to the top.

### 3. 🔒 Dedicated Private Admin Portal
* **Hidden from Customers**: All public admin buttons, links, and product modification options are removed from customer-facing headers and footers.
* **Accessing the Portal**:
  * **Direct URL**: Navigate to `/#admin` (e.g. `http://localhost:3000/#admin` or `https://yourdomain.com/#admin`).
  * **Keyboard Shortcut**: Press `Ctrl` + `Alt` + `A` (or `Cmd` + `Alt` + `A`).
  * **Discreet Footer Touchpoint**: Click the subtle lock `🔒` icon next to the copyright text at the bottom of the page.
* **Passcode Protected**: Secure login with default passcode `kvn2026` or registered phone number `9787513911`. Includes a *"Remember on this device"* option.
* **Product Management**:
  * **+ Add Product**: Easily add new tea, coffee, or combos with weight variants, MRP, selling price, stock, images, description, brewing steps, and badges (*New Arrival*, *Customer Favourite*).
  * **Live Sync**: Changes made in the Admin Dashboard immediately update the live customer storefront in real time.
* **Order & Inventory Tracking**:
  * Manage customer orders, track statuses (`Pending` ➔ `Confirmed` ➔ `Dispatched` ➔ `Delivered`), add courier tracking IDs.
  * Real-time stock alerts for low inventory (≤ 5 units).

---

## 🛠️ Tech Stack

* **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Bundler & Dev Server**: [Vite 6](https://vitejs.dev/)
* **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Animations**: Lightweight hardware-accelerated CSS + native `IntersectionObserver`
* **Persistence**: LocalStorage with real-time custom event broadcasting

---

## 💻 Getting Started Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* npm, pnpm, or bun

### Installation
```bash
# Clone the repository
git clone https://github.com/kavinash008/KVN-tea-powder.git
cd KVN-tea-powder

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit the app in your browser:
* **Customer Store**: `http://localhost:3000/`
* **Admin Portal**: `http://localhost:3000/#admin` *(Passcode: `kvn2026` or `9787513911`)*

### Build for Production
```bash
npm run build
```
The output files will be in the `dist/` directory, ready to deploy to Vercel, Netlify, Firebase, or GitHub Pages.

---

## 📞 Contact & Business Information

* **Brand**: KVN TEAPOWDER
* **Proprietor**: Krishnamoorthy
* **Primary Orders**: +91 9787513911
* **Secondary Orders**: +91 6383050287
* **Email**: krishnamoorthykavinash@gmail.com
* **Origin**: Direct estate-blended tea & coffee in Tamil Nadu, India.
