import { Hono } from 'hono'
import { quizController } from '../controllers/quiz.controller.js'

export const quizzesRoute = new Hono()

// Create quiz by generating from text or PDF
quizzesRoute.post('/generate', (c) => quizController.generate(c))

// Get a quiz by id (optional includeAnswers=true)
quizzesRoute.get('/:id', (c) => quizController.getById(c))

// Update quiz title/description (owner-only)
quizzesRoute.patch('/:id', (c) => quizController.update(c))

// Delete a quiz (owner-only)
quizzesRoute.delete('/:id', (c) => quizController.remove(c))

export default quizzesRoute

