# Geo-kernel — Cargo Link MVP
 <img width="804" height="623" alt="download" src="https://github.com/user-attachments/assets/c796a82b-e939-4fc0-b98a-d8948688aad2" />

A lightweight logistics marketplace that connects **cargo shippers** with **truck drivers**. Shippers post freight orders, drivers browse and accept available loads, and everyone sees updates **in real time** as orders move from *available → in transit → delivered*.

Built as a fast, dependency-light MVP using [Fastify](https://fastify.dev/), Server-Sent Events (SSE) for live updates, and flat JSON files for storage (no database required).

---

## ✨ Features

- **Order marketplace** — shippers create freight orders (cargo, weight, route, distance, price, dates).
- **Driver matching** — drivers can take available orders and mark them delivered.
- **Real-time updates** — live push of new orders, taken orders, and deliveries via SSE (no polling).
- **Driver registry** — drivers with truck type, capacity, rating, trip history, and supported cargo types.
- **Zero database** — all state persists to human-readable JSON files in `data/`.
- **Multi-project hosting** — server is set up to serve two static front-ends (`/` and `/project2/`).

---

## 🛠️ Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Runtime      | Node.js (ES Modules)                |
| Web server   | [Fastify 5](https://fastify.dev/)   |
| Static files | `@fastify/static`                   |
| CORS         | `@fastify/cors`                     |
| Live updates | Server-Sent Events (SSE)            |
| Storage      | JSON files (`data/orders.json`, `data/drivers.json`) |
| Frontend     | Single-page HTML/CSS/JS             |

---

## 📁 Project Structure

```
geo-kernel/
├── server.js              # Fastify server: API, SSE, static hosting
├── package.json
├── data/
│   ├── orders.json        # Freight orders (persisted)
│   └── drivers.json       # Driver registry (persisted)
└── public/
    ├── project1/          # Geo-kernel front-end (served at /)
    │   └── index.html
    └── project2/          # Reserved for a second app (served at /project2/)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (ES Modules support)

### Install & Run

```bash
# Install dependencies
npm install

# Start the server
node server.js
```

The server starts on **http://localhost:3000**:

- **Project 1 (Geo-kernel):** http://localhost:3000/
- **Project 2 (reserved):** http://localhost:3000/project2/
- **API base:** http://localhost:3000/api/...

---

## 📡 API Reference

Base URL: `http://localhost:3000`

### Orders

| Method | Endpoint                  | Description                                  |
|--------|---------------------------|----------------------------------------------|
| `GET`  | `/api/orders`             | List all orders.                             |
| `POST` | `/api/orders`             | Create a new order (shipper).                |
| `POST` | `/api/orders/:id/take`    | A driver accepts an available order.         |
| `POST` | `/api/orders/:id/complete`| Mark an in-transit order as delivered.       |

### Drivers

| Method | Endpoint        | Description           |
|--------|-----------------|-----------------------|
| `GET`  | `/api/drivers`  | List all drivers.     |

### Real-time events

| Method | Endpoint        | Description                              |
|--------|-----------------|------------------------------------------|
| `GET`  | `/api/events`   | SSE stream of live updates (see below).  |

---

### Request / Response examples

**Create an order** — `POST /api/orders`

```json
{
  "cargo": "Цемент в мешках",
  "tons": 20,
  "from": "Актау",
  "to": "Жанаозен",
  "km": 147,
  "price": 258500,
  "date": "2026-06-12",
  "shipperName": "ТОО \"Мангистау Курылыс\"",
  "shipperPhone": "+7 701 000 11 22",
  "cargoType": "cement"
}
```

The server assigns an `id` (`RD_<timestamp>`), sets `status: "available"` and `driverId: null`, persists it, and broadcasts a `new_order` event.

**Take an order** — `POST /api/orders/:id/take`

```json
{ "driverId": "DRV_3" }
```

Sets the order to `in_transit`, assigns the driver, and marks the driver `busy`. Returns `409` if the order is already taken, `404` if the order or driver is not found.

**Complete an order** — `POST /api/orders/:id/complete`

Sets the order to `delivered` and frees the assigned driver.

---

## 🔄 Real-Time Updates (SSE)

Clients subscribe to `GET /api/events` to receive a live stream. Emitted events:

| Event             | Fired when…                  | Payload                |
|-------------------|------------------------------|------------------------|
| `connected`       | Connection established        | `{}`                   |
| `new_order`       | A shipper creates an order    | the new order          |
| `order_taken`     | A driver accepts an order     | `{ order, driver }`    |
| `order_delivered` | A driver completes an order   | `{ order, driver }`    |

**Browser example:**

```js
const es = new EventSource('http://localhost:3000/api/events')
es.addEventListener('new_order', (e) => {
  const order = JSON.parse(e.data)
  console.log('New order:', order)
})
```

---

## 📦 Data Models

**Order**
```json
{
  "id": "RD_1781067734389",
  "cargo": "Цемент в мешках",
  "tons": 20,
  "from": "Актау",
  "to": "Жанаозен",
  "km": 147,
  "price": 258500,
  "date": "2026-06-12",
  "status": "available | in_transit | delivered",
  "driverId": "DRV_3 | null",
  "shipperName": "ТОО \"...\"",
  "shipperPhone": "+7 701 ...",
  "cargoType": "cement"
}
```

**Driver**
```json
{
  "id": "DRV_1",
  "name": "Азамат Серіков",
  "truckType": "Тент (Еврофура)",
  "plate": "128 АС 12",
  "capacity": 30,
  "rating": 4.9,
  "trips": 142,
  "phone": "+7 701 555 12 34",
  "status": "free | busy",
  "cargoTypes": ["cement", "equipment", "general"]
}
```

---

## ⚠️ Notes & Limitations

This is an **MVP** intended for demos and prototyping:

- **JSON file storage** — fine for single-instance demos, but not safe for concurrent writes at scale. Swap for a real database before production.
- **No authentication** — endpoints are open and CORS is `*`.
- **In-memory SSE clients** — connections live only for the server process lifetime.
