import { Hono } from 'hono'
import { APIAuth } from './auth/index.js'
import { APIQuiz } from './quiz/index.js'
import { Gemini } from './gemini/index.js'

const app = new Hono()

app.route("/", APIAuth)
app.route("/", APIQuiz )
app.route("/", Gemini)

export { app as APIRoutes }