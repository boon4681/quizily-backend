import { auth } from '$auth.config';
import { RequiredAuthMiddleware, type AuthEnvironment } from '$middleware/auth.js';
import { Hono } from 'hono'

const app = new Hono<AuthEnvironment>()

app.use("*", RequiredAuthMiddleware)

app.get("/user/@me", (c) => {
    return c.json(c.get("user"))
})

export { app as APIUser }