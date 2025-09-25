import { Hono } from 'hono'
import { genAI, generateQuiz } from '../../services/gemini.js'


const app = new Hono()

app.get("/gemini/*", genAI);
app.get("/generateQuiz/*", generateQuiz);

export {app as Gemini}