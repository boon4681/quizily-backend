import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { APIRoutes } from './routes/index.js'

const app = new Hono()

app.get('/', (c) => {
    return c.text('Quizily backend!')
})

app.route("/api", APIRoutes)

serve({
    fetch: app.fetch,
    port: 3000
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
})
