import { Hono } from 'hono'
import { APIAuth } from './auth/index.js'

const app = new Hono()

app.route("/", APIAuth)

export { app as APIRoutes }