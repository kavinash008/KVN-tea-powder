# 🌿 KVN TEAPOWDER — Official Online Store & Admin Portal

> Authentic Nilgiri Tea Blends & Traditional South Indian Filter Coffee Powders. Handcrafted and blended with love in Tamil Nadu by **Krishnamoorthy**.

---

## 🌟 Overview

**KVN TEAPOWDER** is a full-stack, mobile-first e-commerce web application featuring a customer storefront, customer account & delivery address management, and a private administration portal powered by a shared persistent database (**MongoDB Atlas** + Vercel Serverless Functions).

* **Customer Storefront**: Browse authentic Nilgiri teas, strong filter coffee blends, and family combos with multiple weight variants (250g, 500g, 1kg), smart cart, saved delivery addresses, device GPS auto-fill, and instant order placement.
* **Customer Account**: Secure customer registration and login with encrypted passwords, saved address book (Home, Work), and complete personal order history.
* **Private Admin Portal**: Protected management dashboard for Krishnamoorthy to manage orders in real-time across all customer devices, update delivery lifecycles (`Order Confirmed` ➔ `Processing` ➔ `Dispatched` ➔ `Delivered`), add products, and manage live inventory.

---

## 🚀 Key Features

### 1. 🌐 Shared Cross-Device Persistent Database (MongoDB Atlas)
* **Real-Time Cross-Device Sync**: Orders submitted by any customer from any phone, computer, or browser immediately save to the central database and appear in the Admin Portal.
* **Vercel Serverless Architecture**: Dedicated Express `/api` backend handles `/api/orders`, `/api/auth/*`, and `/api/admin/*` seamlessly.
* **Zero Downtime Fallback**: Automatic failover to local persistent storage ensures continuous availability.

### 2. 🔐 Customer Registration & Authentication
* **Cryptographic Security**: Passwords are securely hashed with random salts using Node.js native `scrypt`.
* **Private Order History**: Customers can view their orders, delivery statuses, and track live packages while maintaining strict privacy isolation.
* **Saved Address Management**: Save multiple delivery addresses (Home, Work, etc.), select pre-set defaults at checkout, and manage contacts.

### 3. 📍 Optional GPS Location & Smart Address Fill
* **One-Tap GPS Auto-Fill**: Customers can click *"📍 Use My Location"* to detect coordinates and reverse-geocode street name, village/town, district, and PIN code.
* **Zero Background Tracking**: Location permission is requested only on-demand and coordinates are editable by the customer.

### 4. 📱 Ultra-Responsive & Mobile-First Storefront
* **Zero-Overflow Mobile Header**: Fits all screen sizes down to 320px with quick slide-down search.
* **Hardware-Accelerated 60fps Animations**: Powered by browser-native `IntersectionObserver` with GPU 3D transforms.
* **Weight Variants & Authoritative Pricing**: Supports 250g, 500g, and 1kg with server-side validation to prevent price tampering.

### 5. 🔒 Dedicated Private Admin Portal
* **Accessing the Portal**:
  * **Direct URL**: Navigate to `/#admin` (e.g. `https://kvnteapowder.vercel.app/#admin`).
  * **Keyboard Shortcut**: Press `Ctrl` + `Alt` + `A` (or `Cmd` + `Alt` + `A`).
  * **Discreet Footer Lock**: Click the subtle lock `🔒` icon in the footer.
* **Passcode Protected**: Secure admin authentication via `POST /api/admin/login` (passcode: `kvn2026` or registered phone `9787513911`).
* **Live Order Stream**: 15-second automatic polling and manual sync button to review new customer orders instantly.
* **Order Lifecycle Controls**: Update statuses (`Order Confirmed`, `Processing`, `Dispatched`, `Out for Delivery`, `Delivered`, `Cancelled`) with automatic status history logging.

---

## 🛠️ Tech Stack

* **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
* **Backend**: [Express 4](https://expressjs.com/), [Vercel Serverless Functions](https://vercel.com/docs/functions)
* **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) with automatic persistent file fallback
* **Security**: Native `crypto.scryptSync` password hashing & HMAC-SHA256 JWT session tokens
* **Bundler & Dev Server**: [Vite 6](https://vitejs.dev/) with integrated dev server API middleware

---

## 💻 Getting Started Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* npm

### Installation
```bash
# Clone the repository
git clone https://github.com/kavinash008/KVN-tea-powder.git
cd KVN-tea-powder

# Install dependencies
npm install

# Start local development server (serves frontend & backend together on port 3000)
npm run dev
```

Visit the app in your browser:
* **Customer Store**: `http://localhost:3000/`
* **Admin Portal**: `http://localhost:3000/#admin` *(Passcode: `kvn2026`)*

### Build for Production
```bash
npm run build
```

---

## ⚙️ Environment Variables (Vercel)

| Variable | Description |
| :--- | :--- |
| `MONGODB_URI` | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `MONGODB_DB_NAME` | Database name (e.g. `kvn_store`) |
| `ADMIN_PASSWORD` | Passcode for Krishnamoorthy to log into the Admin Dashboard (`kvn2026`) |
| `JWT_SECRET` | Secret key for signing customer and admin session tokens |

---

## 📞 Contact & Business Information

* **Brand**: KVN TEAPOWDER
* **Proprietor**: Krishnamoorthy
* **Primary Orders**: +91 9787513911
* **Secondary Orders**: +91 6383050287
* **Email**: krishnamoorthykavinash@gmail.com
* **Origin**: Direct estate-blended tea & coffee in Tamil Nadu, India.
