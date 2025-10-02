import { auth } from '$auth.config';
import { Hono } from 'hono';
const app = new Hono();
app.on(["POST", "GET"], "/auth/*", (c) => {
    return auth.handler(c.req.raw);
});
export { app as APIAuth };
