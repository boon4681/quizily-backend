import { createPartFromUri, Files, GoogleGenAI, Type, type ContentListUnion } from '@google/genai';
import type { Context } from 'hono'
import type { CREATE_QUIZ_BODY } from './quiz.validator.js';
import { STRUCTURED_BINARY_QUIZ_OUTPUT_V1, TEMPLATE_BINARY_QUESTION, TEMPLATE_MULTIPLE_CHOICES_QUESTION } from './quiz.constant.js';
import { QuestionType, QuizState, type Prisma } from '@prisma/client';
import { prisma } from '$database';
import T from "typebox"
import { createId } from "@paralleldrive/cuid2";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function UploadResource(resource: File) {
    const buffer = await resource.arrayBuffer()

    const fileBlob = new Blob([buffer], { type: resource.type });

    const file = await ai.files.upload({
        file: fileBlob,
        config: {
            displayName: resource.name,
        },
    });

    let getFile = await ai.files.get({ name: file.name! });
    while (getFile.state === 'PROCESSING') {
        getFile = await ai.files.get({ name: file.name! });
        console.log(`current file status: ${getFile.state}`);
        console.log('File is still processing, retrying in 5 seconds');

        await new Promise((resolve) => {
            setTimeout(resolve, 5000);
        });
    }
    if (file.state === 'FAILED') {
        throw new Error('File processing failed.');
    }
    if (file.uri && file.mimeType) {
        return createPartFromUri(file.uri, file.mimeType);
    }
}

export async function GenerateQuiz(quiz: { id: string }, body: CREATE_QUIZ_BODY) {
    console.log("GENERATE")
    let start = Date.now()
    const contents: ContentListUnion = []
    switch (body.type) {
        case "binary": {
            contents.push(TEMPLATE_BINARY_QUESTION())
            break
        }
        case "multiple": {
            contents.push(TEMPLATE_MULTIPLE_CHOICES_QUESTION())
            break
        }
    }
    switch (body.resource_type) {
        case "document": {
            const files = [body.files].flat()
            for (const resource of files) {
                const part = await UploadResource(resource)
                if (part) contents.push(part)
            }
            break
        }
        case "text": {
            contents.push(body.content)
            break
        }
    }

    const struct = STRUCTURED_BINARY_QUIZ_OUTPUT_V1(body.amount)
    type struct = T.Static<typeof struct>
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: struct
        }
    }).catch(a => false as false);
    if (!response || !response.text) {
        await prisma.quiz.update({
            where: {
                id: quiz.id
            },
            data: {
                state: QuizState.ERROR
            }
        })
        return;
    }
    if (response.text) {
        const json = JSON.parse(response.text) as struct
        await prisma.quiz.update({
            where: {
                id: quiz.id
            },
            data: {
                title: json.name,
                emoji: json.emoji,
                questions: json.questions.map(a => {
                    return {
                        id: createId(),
                        title: a.title,
                        type: body.type == "binary" ? QuestionType.TRUE_FALSE : QuestionType.MULTIPLE_CHOICE,
                        options: a.options.map(a => {
                            return {
                                id: createId(),
                                text: a.text,
                                isCorrect: a.is_correct
                            }
                        })
                    }
                }),
                state: QuizState.FINISHED
            }
        })
        console.log("DONE", Date.now() - start)
    }
}