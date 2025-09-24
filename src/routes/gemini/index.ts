import { Hono } from 'hono'
import { genAI } from '../../services/gemini.js'


const app = new Hono()

app.get("/gemini/*", genAI);

export {app as Gemini}