import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyCors from '@fastify/cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = Fastify({ logger: false })

const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json')
const DRIVERS_FILE = path.join(__dirname, 'data', 'drivers.json')

// SSE clients
const sseClients = new Set()

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients) {
    try { client.raw.write(msg) } catch {}
  }
}

await app.register(fastifyCors, { origin: '*' })

// ── Static: Project 2 FIRST (more specific prefix)
await app.register(fastifyStatic, {
  root: path.join(__dirname, 'public/project2'),
  prefix: '/project2/',
  decorateReply: false
})

// ── Static: Project 1 (root)
await app.register(fastifyStatic, {
  root: path.join(__dirname, 'public/project1'),
  prefix: '/',
  decorateReply: true
})

// ── SSE endpoint
app.get('/api/events', (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')
  reply.raw.setHeader('Access-Control-Allow-Origin', '*')
  reply.raw.flushHeaders()
  reply.raw.write('event: connected\ndata: {}\n\n')

  sseClients.add(reply)
  req.raw.on('close', () => sseClients.delete(reply))
})

// ── GET all orders
app.get('/api/orders', async () => readJSON(ORDERS_FILE))

// ── GET all drivers
app.get('/api/drivers', async () => readJSON(DRIVERS_FILE))

// ── POST new order (shipper creates)
app.post('/api/orders', async (req, reply) => {
  const orders = readJSON(ORDERS_FILE)
  const { cargo, tons, from, to, km, price, date, shipperName, shipperPhone, cargoType } = req.body
  const id = 'RD_' + Date.now()
  const order = { id, cargo, tons, from, to, km, price, date, status: 'available', driverId: null, shipperName, shipperPhone, cargoType }
  orders.unshift(order)
  writeJSON(ORDERS_FILE, orders)
  broadcast('new_order', order)
  return order
})

// ── POST take order (driver accepts)
app.post('/api/orders/:id/take', async (req, reply) => {
  const orders = readJSON(ORDERS_FILE)
  const drivers = readJSON(DRIVERS_FILE)
  const order = orders.find(o => o.id === req.params.id)
  if (!order) return reply.code(404).send({ error: 'Not found' })
  if (order.status !== 'available') return reply.code(409).send({ error: 'Already taken' })

  const { driverId } = req.body
  const driver = drivers.find(d => d.id === driverId)
  if (!driver) return reply.code(404).send({ error: 'Driver not found' })

  order.status = 'in_transit'
  order.driverId = driverId
  driver.status = 'busy'
  writeJSON(ORDERS_FILE, orders)
  writeJSON(DRIVERS_FILE, drivers)

  broadcast('order_taken', { order, driver })
  return { order, driver }
})

// ── POST complete order (driver delivers)
app.post('/api/orders/:id/complete', async (req, reply) => {
  const orders = readJSON(ORDERS_FILE)
  const drivers = readJSON(DRIVERS_FILE)
  const order = orders.find(o => o.id === req.params.id)
  if (!order) return reply.code(404).send({ error: 'Not found' })

  const driver = drivers.find(d => d.id === order.driverId)
  order.status = 'delivered'
  if (driver) driver.status = 'free'
  writeJSON(ORDERS_FILE, orders)
  writeJSON(DRIVERS_FILE, drivers)

  broadcast('order_delivered', { order, driver })
  return { order, driver }
})

app.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1) }
  console.log('🚛 Cargo Link server running on http://localhost:3000')
  console.log('   Project 1 (Cargo Link): http://localhost:3000/')
  console.log('   Project 2 (yours later): http://localhost:3000/project2/')
  console.log('   API: http://localhost:3000/api/...')
})
