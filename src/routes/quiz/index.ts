
import { Hono } from 'hono'
import { getQuiz, makeQuiz } from '../../quizcontroller/index.js';
import { getQuizLink } from '../../quizcontroller/index.js';

const app = new Hono()

app.post("/quiz", makeQuiz)
app.post("/quiz/:id/share", getQuizLink)

app.get ("/quiz/share/:token", getQuiz)

export {app as APIQuiz}