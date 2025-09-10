
import { Hono } from 'hono'
import { makeQuiz } from '../../quizcontroller/index.js';

const app = new Hono()

app.post("/quiz/*", makeQuiz)

export {app as APIQuiz}