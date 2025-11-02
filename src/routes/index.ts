import { Hono } from 'hono'
import { APIAuth } from './auth/index.js'
import { APIUser } from './user/index.js'
import { APIQuiz } from './quiz/index.js'

const app = new Hono()

app.route("/", APIAuth)
app.route("/", APIUser)
app.route("/", APIQuiz)

export { app as APIRoutes }