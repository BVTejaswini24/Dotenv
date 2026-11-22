# 🛍️ ShopSphere — AI-Powered E-Commerce Platform

### A Modern, Intelligent and Personalized Online Shopping Experience

ShopSphere is a full-stack e-commerce platform designed to deliver a seamless, intelligent and interactive online shopping experience.

The platform combines modern web technologies, scalable backend architecture, real-time event-driven processing, advanced product search, computer vision and AI-powered virtual try-on capabilities.

From browsing products and managing shopping carts to discovering products through intelligent search and experiencing AI-powered virtual try-on, ShopSphere aims to make online shopping more interactive, personalized and efficient.

---

## ✨ Key Features

### 🛒 1. Modern E-Commerce Experience

- Responsive and modern shopping interface.
- Dynamic product catalogue.
- Multiple product categories.
- Product details and image galleries.
- Product filtering and sorting.
- Product discovery and browsing.
- Search functionality.
- Product recommendations and alternatives.
- Brand and category-based navigation.
- Responsive layouts for desktop, tablet and mobile devices.

### 👤 2. User Experience and Shopping Management

- User account and authentication functionality.
- Shopping cart management.
- Wishlist management.
- Add-to-cart functionality.
- Product quantity management.
- Checkout experience.
- Customer contact information.
- Delivery and shipping information.
- Order summary.
- Payment section.
- Cart and wishlist synchronization.

### 🔍 3. Advanced Product Search — OpenSearch

ShopSphere integrates OpenSearch to provide advanced product discovery and search capabilities.

Features include:

- Search across the product catalogue.
- Fast product retrieval.
- Search integration with the backend.
- Product indexing and search operations.
- Improved product discovery.
- Search functionality integrated into the frontend.

OpenSearch provides a dedicated search layer rather than relying exclusively on traditional database queries.

### ⚡ 4. Event-Driven Architecture — Apache Kafka

Apache Kafka is integrated into the backend architecture to support event-driven communication and asynchronous processing.

Key capabilities:

- Kafka-based event integration.
- Producer and consumer architecture.
- Event-driven backend workflows.
- Communication between application components.
- Integration with the product search infrastructure.
- Support for scalable asynchronous processing.

Kafka helps decouple application components and provides a foundation for processing application events independently.

### 🤖 5. AI-Powered Virtual Try-On

ShopSphere includes an AI Virtual Try-On feature developed using Hugging Face integration.

The feature aims to make online fashion shopping more interactive by allowing users to visualize clothing on images of themselves.

Key capabilities:

- AI-powered virtual try-on experience.
- Hugging Face model integration.
- Image-based processing workflow.
- Interactive fashion visualization.
- Improved online product evaluation.

### 📸 6. Computer Vision and Image Processing — OpenCV

OpenCV (Open Source Computer Vision Library) is used for computer vision and image-processing capabilities where integrated into the application workflow.

Relevant image-processing operations include:

- Image loading and handling.
- Image resizing and cropping.
- Image transformations.
- Color-space conversion.
- Image preprocessing.
- Preparation of images for computer vision workflows.

OpenCV can support image preparation and processing in AI-based visual applications.

**Note:** The exact OpenCV operations and their connection to the Virtual Try-On workflow should be documented according to the implemented source code.

### 🖼️ 7. Expanded Product Catalogue

The platform includes an expanded product catalogue with additional product images across multiple categories.

Catalogue improvements include:

- Expanded product data.
- Additional product images.
- Category-wise product organization.
- Product image galleries.
- Updated product information.
- Improved product browsing experience.

The expanded catalogue includes 204 additional product images.

### 📱 8. Responsive User Interface

The frontend is designed to provide a consistent shopping experience across different screen sizes.

Responsive improvements include:

- Mobile-friendly navigation.
- Responsive product cards.
- Mobile filter interactions.
- Responsive product galleries.
- Improved shopping cart layouts.
- Responsive checkout sections.
- Optimized homepage sections.
- Improved spacing and component layouts.

---

## 🧰 Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js | Frontend framework |
| React.js | Component-based UI |
| TypeScript | Type safety |
| Tailwind CSS | Styling and responsive layouts |
| JavaScript | Application functionality |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | Server-side runtime |
| Express.js | Backend API framework |
| TypeScript | Backend development |
| PostgreSQL | Relational database |
| Apache Kafka | Event streaming |
| OpenSearch | Search and indexing |

### AI and Computer Vision

| Technology | Purpose |
|---|---|
| Hugging Face | AI model integration for Virtual Try-On |
| OpenCV | Computer vision and image processing |

### Database and Infrastructure

| Technology | Purpose |
|---|---|
| PostgreSQL | Application data storage |
| Aiven | Managed database infrastructure |
| Kafka | Event-driven processing |
| OpenSearch | Product search infrastructure |

### Deployment

| Platform | Purpose |
|---|---|
| Vercel | Frontend deployment |
| Railway | Backend deployment |
| Aiven | Managed PostgreSQL infrastructure |

---

## 🏗️ System Architecture

ShopSphere follows a frontend-backend architecture with dedicated database, messaging, search and AI components.

```text
                  ┌──────────────────────┐
                  │       USER           │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   NEXT.JS FRONTEND   │
                  │                      │
                  │  Shopping Interface  │
                  │  Product Catalogue   │
                  │  Cart & Wishlist     │
                  │  Checkout            │
                  │  Virtual Try-On      │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   EXPRESS BACKEND    │
                  │                      │
                  │      REST APIs       │
                  │   Business Logic     │
                  │   Authentication     │
                  └──────────┬───────────┘
                             │
             ┌───────────────┼────────────────┐
             │               │                │
             ▼               ▼                ▼
      ┌────────────┐  ┌────────────┐  ┌──────────────┐
      │ PostgreSQL │  │   Kafka    │  │  OpenSearch  │
      │            │  │            │  │              │
      │ Application│  │ Producers  │  │ Product      │
      │ Data       │  │ Consumers  │  │ Search       │
      └────────────┘  └─────┬──────┘  └──────────────┘
                            │
                            ▼
                     Event Processing

             ┌───────────────────────────┐
             │      AI SERVICES          │
             │                           │
             │  Hugging Face             │
             │  OpenCV                   │
             │  Virtual Try-On Workflow  │
             └───────────────────────────┘
```

*The diagram represents the logical architecture. Actual communication paths depend on the implemented backend services.*

---

## 📂 Project Structure

```text
Dotenv/
│
├── backend/
│   ├── src/
│   │   ├── data/
│   │   │   └── catalog.json
│   │   ├── server.ts
│   │   └── ...
│   │
│   ├── package.json
│   └── .env.example
│
├── public/
│   └── images/
│       └── products/
│           ├── accessories/
│           ├── hoodies/
│           ├── jackets/
│           ├── jeans/
│           ├── pants/
│           ├── shirts/
│           ├── shorts/
│           └── t-shirts/
│
├── scripts/
│   ├── build-expanded-catalog.js
│   ├── download-catalog-images.js
│   ├── e2e-catalog-test.js
│   ├── patch-filters.js
│   ├── update-homepage-data.js
│   └── verify-catalog.js
│
├── src/
│   ├── app/
│   │   ├── checkout/
│   │   ├── shop/
│   │   ├── watchlist/
│   │   └── ...
│   │
│   ├── components/
│   │   ├── cart-page/
│   │   ├── checkout-page/
│   │   ├── common/
│   │   ├── homepage/
│   │   ├── layout/
│   │   ├── product-page/
│   │   ├── shop-page/
│   │   ├── ui/
│   │   └── wishlist-page/
│   │
│   ├── lib/
│   └── styles/
│
├── package.json
├── README.md
└── ...
```

---

## ⚙️ Getting Started

Follow these steps to run the project locally.

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git
- PostgreSQL connection
- Required Kafka and OpenSearch services for their respective integrations

### 1. Clone the Repository

```bash
git clone https://github.com/BVTejaswini24/Dotenv.git
```

```bash
cd Dotenv
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Configure Frontend Environment Variables

Create a `.env.local` file in the project root.

Add the required frontend environment variables according to the project's configuration.

For example:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Replace the example API URL with your actual backend URL.

### 4. Start the Frontend

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

### 5. Configure the Backend

Navigate to the backend directory:

```bash
cd backend
```

Install backend dependencies:

```bash
npm install
```

Create a `.env` file using the provided `.env.example` template.

Configure the required environment variables.

Example:

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=your_postgresql_connection_string
DATABASE_SSL=true

JWT_SECRET=your_secret_key

CORS_ORIGIN=http://localhost:3000
```

Additional Kafka, OpenSearch and AI service variables should be configured according to the backend implementation.

**Never commit actual credentials, API keys or database passwords to GitHub.**

### 6. Start the Backend

Use the development command configured in `backend/package.json`.

For production-style execution, if the backend build scripts are configured:

```bash
npm run build
npm start
```

The backend will run on the configured port.

---

## 🔐 Environment Variables

The application uses environment variables to manage configuration and sensitive credentials.

| Variable | Description |
|---|---|
| NODE_ENV | Application environment |
| PORT | Backend server port |
| DATABASE_URL | PostgreSQL connection string |
| DATABASE_SSL | Database SSL configuration |
| JWT_SECRET | Authentication secret |
| CORS_ORIGIN | Allowed frontend origin |
| NEXT_PUBLIC_API_URL | Frontend API endpoint |

Kafka, OpenSearch and Hugging Face credentials or service endpoints must be configured using the actual variable names defined in their respective modules.

---

## 🚀 Deployment

The project uses separate deployment environments for its frontend and backend.

### Frontend

The Next.js application is deployed using Vercel.

### Backend

The Express.js backend is deployed separately using Railway.

### Database

PostgreSQL is hosted through Aiven.

Kafka and OpenSearch are configured as separate infrastructure services.

Deployment requires the appropriate environment variables to be configured on each hosting platform.

---

## 🧪 Testing and Validation

The project includes scripts to support catalogue validation and testing.

Available scripts include:

- `build-expanded-catalog.js` — Expanded catalogue generation.
- `download-catalog-images.js` — Product image downloading.
- `e2e-catalog-test.js` — Catalogue-related end-to-end testing.
- `patch-filters.js` — Filter-related updates.
- `update-homepage-data.js` — Homepage data updates.
- `verify-catalog.js` — Catalogue verification.

Frontend TypeScript validation:

```bash
npx tsc --noEmit
```

---

## 🔮 Future Improvements

Potential future improvements include:

- Enhanced personalized product recommendations.
- Improved AI-powered shopping assistance.
- More advanced virtual try-on capabilities.
- Enhanced product discovery and filtering.
- Advanced search ranking.
- Improved performance and scalability.
- Comprehensive automated testing.
- Enhanced analytics and monitoring.

---

## 👩‍💻 Development and Collaboration

This project is developed collaboratively, with contributions across frontend development, backend engineering, database integration, search infrastructure, event-driven processing and AI-powered features.

The project brings together multiple technologies to explore how modern e-commerce applications can deliver more intelligent, scalable and interactive shopping experiences.

---

## 📌 Repository

**Deployment:** https://dotenv-two.vercel.app/

**Project:** ShopSphere — AI-Powered E-Commerce Platform

---

## 📄 License

Add the appropriate license for this project before distributing or reusing the source code.

---

### Built with ❤️ using modern web technologies, AI, computer vision and scalable backend systems.
