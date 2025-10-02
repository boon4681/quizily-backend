import { Hono } from 'hono'
import { quizController } from '../controllers/quiz.controller.js'

export const quizzesRoute = new Hono()

quizzesRoute.post('/generate', (c) => quizController.generate(c))
quizzesRoute.get('/:id', (c) => quizController.getById(c))
quizzesRoute.patch('/:id', (c) => quizController.update(c))
quizzesRoute.delete('/:id', (c) => quizController.remove(c))

export default quizzesRoute

