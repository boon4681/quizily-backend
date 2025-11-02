import { auth } from '$auth.config';
import { RequiredAuthMiddleware, type AuthEnvironment } from '$middleware/auth.js';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono'
import z from 'zod';
import { CREATE_QUIZ_BODY, PATCH_QUIZ_SHARE_BODY, POST_QUIZ_SAVE_BODY } from './quiz.validator.js';
import { GenerateQuiz } from './quiz.service.js';

import "./queue.service.js"
import { queue } from './queue.service.js';
import { prisma } from '$database';
import { QuizState, type Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const app = new Hono<AuthEnvironment>()

const ERROR = (a: any) => {
    console.log(a)
    return false as false
}

app.use("*", RequiredAuthMiddleware)

app.get("/quiz/list", async (c) => {
    const user = c.get("user")!
    const quiz = await prisma.quiz.findMany({
        where: {
            ownerId: user.id
        },
        select: {
            id: true,
            title: true,
            emoji: true,
            description: true,
            share: true,
            shareId: true,
            state: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    }).catch(ERROR)
    if (!quiz) return c.json({
        code: 500,
        message: "Internal server error"
    }, 500)
    return c.json({
        code: 200,
        message: "success",
        data: quiz
    })
})

app.get("/quiz/:id", async (c) => {
    const quiz_id = c.req.param("id")
    const quiz = await prisma.quiz.findFirst({
        where: {
            id: quiz_id
        }
    })
    if (!quiz) return c.json({
        code: 404,
        message: 'quiz not found'
    }, 404)
    return c.json({
        code: 200,
        message: 'success',
        data: quiz
    })
})

app.delete("/quiz/:id", async (c) => {
    const quiz_id = c.req.param("id")
    const quiz = await prisma.quiz.findFirst({
        where: {
            id: quiz_id
        }
    })
    if (!quiz) return c.json({
        code: 404,
        message: 'quiz not found'
    }, 404)
    const result = await prisma.quiz.delete({
        where: {
            id: quiz_id
        }
    }).catch(ERROR)
    if (!result) return c.json({
        code: 500,
        message: "Internal server error"
    }, 500)
    return c.json({
        code: 200,
        message: 'success'
    })
})

app.post("/quiz/create", zValidator('form', CREATE_QUIZ_BODY), async (c) => {
    const body = c.req.valid("form")
    const user = c.get("user")!
    const quiz = await prisma.quiz.create({
        data: {
            title: '',
            state: QuizState.PENDING,
            ownerId: user.id,
        }
    })
    queue.add(() => {
        GenerateQuiz(quiz, body)
    })
    return c.json({
        code: 200,
        message: 'success',
        data: {
            id: quiz.id,
            state: quiz.state
        }
    })
})

// SAVE
app.post("/quiz/:id/save", zValidator("json", POST_QUIZ_SAVE_BODY), async (c) => {
    const quiz_id = c.req.param("id")
    const user = c.get("user")!
    const body = c.req.valid("json")
    const quiz = await prisma.quiz.findFirst({
        where: {
            id: quiz_id,
            ownerId: user.id,
        }
    })
    if (!quiz) return c.json({
        code: 404,
        message: "quiz not found"
    }, 404)
    const result = await prisma.quiz.update({
        where: {
            id: quiz_id
        },
        data: {
            title: body.title,
            description: body.description,
            questions: body.questions?.map(a => {
                return {
                    id: a.id,
                    options: a.choices.map(b => ({ ...b, isCorrect: b.id == a.correct })),
                    title: a.title,
                    type: a.type == "multiple" ? "MULTIPLE_CHOICE" : "TRUE_FALSE",
                }
            }),
        }
    }).catch(ERROR)
    if (!result) return c.json({
        code: 500,
        message: "Internal server error"
    }, 500)
    return c.json({
        code: 200,
        message: "success",
        data: result
    })
})

// SHARE
app.get("/quiz/:sid/share", async (c) => {
    const quiz_share_id = c.req.param("sid")
    const user = c.get("user")!
    const quiz = await prisma.quiz.findFirst({
        where: {
            OR: [
                {
                    AND: {
                        shareId: quiz_share_id,
                        ownerId: user.id
                    }
                },
                {
                    shareId: quiz_share_id,
                    share: true
                }
            ]
        }
    })
    if (!quiz) return c.json({
        code: 404,
        message: 'quiz not found'
    }, 404)
    return c.json({
        code: 200,
        message: "success",
        data: quiz
    })
})

app.patch("/quiz/:id/share", zValidator('json', PATCH_QUIZ_SHARE_BODY), async (c) => {
    const quiz_id = c.req.param("id")
    const body = c.req.valid("json")
    const user = c.get("user")!
    const quiz = await prisma.quiz.findFirst({
        where: {
            AND: {
                id: quiz_id,
                ownerId: user.id
            }
        }
    })
    if (!quiz) return c.json({
        code: 404,
        message: 'quiz not found'
    })
    if (body.share == quiz.share) return c.json({
        code: 200,
        message: "nothing change",
        data: quiz
    })
    let payload: Record<string, any> = {
        share: body.share,
    }
    if (body.share && (quiz.shareId ?? "").length == 0) {
        payload['shareId'] = createId()
    }
    const result = await prisma.quiz.update({
        where: {
            id: quiz.id,
        },
        data: payload
    })
    return c.json({
        code: 200,
        message: "patched",
        data: result
    })
})

export { app as APIQuiz }