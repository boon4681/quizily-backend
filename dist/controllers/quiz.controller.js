import { generateQuizService, getQuizService, updateQuizService, deleteQuizService } from '../services/quiz.service.js';
import { z } from 'zod';
const jsonInputSchema = z.object({
    ownerId: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    text: z.string().optional(),
    pdfBase64: z.string().optional(),
    questionCount: z.number().int().min(1).max(50).optional(),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']).optional(),
    questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE']).optional(),
    modelId: z.string().optional(),
    model: z.string().optional(),
});
function mapErrorToStatus(err) {
    const msg = String(err?.message || '');
    const lower = msg.toLowerCase();
    const isOverloaded = msg.includes('503') || lower.includes('overloaded');
    const isRateLimited = msg.includes('429') || lower.includes('quota') || lower.includes('rate');
    const status = isRateLimited ? 429 : isOverloaded ? 503 : 500;
    const retryMatch = msg.match(/retrydelay\"?\s*:\s*\"?(\d+)(?:\.\d+)?s/i);
    const retryAfter = retryMatch ? retryMatch[1] : undefined;
    return { status, retryAfter, msg };
}
export const quizController = {
    // POST /generate
    async generate(c) {
        try {
            const contentType = c.req.header('content-type') || '';
            let ownerId;
            let title;
            let description;
            let text;
            let questionCount;
            let difficulty;
            let questionType;
            let modelId;
            questionType = parseQuestionType(c.req.query('questionType') || c.req.query('type')) || questionType;
            if (contentType.includes('application/json')) {
                const body = await c.req.json();
                const parsed = jsonInputSchema.parse(body);
                ownerId = parsed.ownerId;
                title = parsed.title;
                description = parsed.description;
                text = parsed.text;
                questionCount = parsed.questionCount;
                difficulty = parsed.difficulty;
                questionType = parsed.questionType ?? questionType;
                modelId = (c.req.query('model') || c.req.query('modelId') || parsed.modelId || parsed.model || '') || undefined;
                if (!text && parsed.pdfBase64) {
                    // convert base64 to Buffer
                    const buf = Buffer.from(parsed.pdfBase64, 'base64');
                    const created = await generateQuizService({ ownerId: ownerId, title, description, pdfBuffer: buf, questionCount, difficulty, questionType, modelId });
                    return c.json({ quiz: created });
                }
            }
            else if (contentType.includes('multipart/form-data')) {
                const form = await c.req.formData();
                ownerId = String(form.get('ownerId') || '');
                title = form.get('title') || undefined;
                description = form.get('description') || undefined;
                const qCount = form.get('questionCount');
                questionCount = qCount ? Number(qCount) : undefined;
                const diff = form.get('difficulty');
                difficulty = diff || undefined;
                const typeField = (form.get('questionType') ?? form.get('type'));
                questionType = typeField ? parseQuestionType(typeField) ?? questionType : questionType;
                modelId = (c.req.query('model') || c.req.query('modelId') || form.get('modelId') || form.get('model') || '').trim() || undefined;
                const textField = form.get('text') || '';
                if (textField) {
                    text = textField;
                }
                else {
                    const file = form.get('file');
                    if (!file)
                        return c.json({ message: 'Provide either text or file' }, 400);
                    const arr = await (file.arrayBuffer?.() ?? Promise.reject(new Error('Invalid file')));
                    const buf = Buffer.from(arr);
                    const created = await generateQuizService({ ownerId: ownerId, title, description, pdfBuffer: buf, questionCount, difficulty, questionType, modelId });
                    return c.json({ quiz: created });
                }
            }
            else {
                return c.json({ message: 'Unsupported content-type. Use application/json or multipart/form-data.' }, 415);
            }
            if (!ownerId)
                return c.json({ message: 'ownerId is required' }, 400);
            if (!text || !text.trim())
                return c.json({ message: 'No text content found to generate quiz' }, 400);
            const created = await generateQuizService({ ownerId, title, description, text, questionCount, difficulty, questionType, modelId });
            return c.json({ quiz: created });
        }
        catch (err) {
            console.error(err);
            const { status, retryAfter, msg } = mapErrorToStatus(err);
            if (retryAfter)
                c.header('Retry-After', retryAfter);
            return c.json({ message: msg || 'Failed to generate quiz' }, status);
        }
    },
    // GET /:id
    async getById(c) {
        try {
            const id = c.req.param('id');
            const includeAnswers = (c.req.query('includeAnswers') || c.req.query('answers') || '').toLowerCase() === 'true';
            const result = await getQuizService(id, includeAnswers);
            if (!result)
                return c.json({ message: 'Quiz not found' }, 404);
            return c.json(result);
        }
        catch (err) {
            console.error(err);
            return c.json({ message: err?.message || 'Failed to fetch quiz' }, 500);
        }
    },
    // PATCH /:id
    async update(c) {
        try {
            const id = c.req.param('id');
            const contentType = c.req.header('content-type') || '';
            let ownerId = (c.req.query('ownerId') || '').trim();
            let title;
            let description;
            if (contentType.includes('application/json')) {
                const body = await c.req.json().catch(() => ({}));
                ownerId = ownerId || (body?.ownerId || '').trim();
                title = (body?.title ?? undefined);
                description = (body?.description ?? undefined);
            }
            else if (contentType.includes('multipart/form-data')) {
                const form = await c.req.formData();
                ownerId = ownerId || String(form.get('ownerId') || '');
                title = form.get('title') || undefined;
                description = form.get('description') || undefined;
            }
            if (!ownerId)
                return c.json({ message: 'ownerId is required' }, 400);
            const updated = await updateQuizService({ id, ownerId, title, description });
            return c.json({ quiz: updated });
        }
        catch (err) {
            console.error(err);
            const msg = String(err?.message || '');
            const status = /forbidden/i.test(msg) ? 403 : /not found/i.test(msg) ? 404 : 500;
            return c.json({ message: msg || 'Failed to update quiz' }, status);
        }
    },
    // DELETE /:id
    async remove(c) {
        try {
            const id = c.req.param('id');
            const contentType = c.req.header('content-type') || '';
            let ownerId = (c.req.query('ownerId') || '').trim();
            if (!ownerId && contentType.includes('application/json')) {
                const body = await c.req.json().catch(() => ({}));
                ownerId = (body?.ownerId || '').trim();
            }
            if (!ownerId)
                return c.json({ message: 'ownerId is required' }, 400);
            const res = await deleteQuizService(id, ownerId);
            return c.json(res);
        }
        catch (err) {
            console.error(err);
            const msg = String(err?.message || '');
            const status = /forbidden/i.test(msg) ? 403 : /not found/i.test(msg) ? 404 : 500;
            return c.json({ message: msg || 'Failed to delete quiz' }, status);
        }
    },
};
function parseQuestionType(value) {
    if (typeof value !== 'string')
        return undefined;
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!normalized)
        return undefined;
    if (normalized === 'TRUE_FALSE' || normalized === 'TRUEFALSE')
        return 'TRUE_FALSE';
    if (normalized === 'MULTIPLE_CHOICE' || normalized === 'MULTIPLECHOICE')
        return 'MULTIPLE_CHOICE';
    return undefined;
}
