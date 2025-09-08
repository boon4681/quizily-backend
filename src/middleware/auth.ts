import { auth, type AuthUserData, type AuthUserSession } from "../auth.config.js";
import { createMiddleware } from 'hono/factory'

type AuthEnvironment = {
    Variables: {
        user: AuthUserData | null;
        session: AuthUserSession | null;
    }
}

export const RequiredAuthMiddleware = createMiddleware<AuthEnvironment>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        c.set("user", null);
        c.set("session", null);
        return c.json({ message: "Unauthorized" }, 401)
    }
    c.set("user", session.user);
    c.set("session", session.session);
    return next();
})
