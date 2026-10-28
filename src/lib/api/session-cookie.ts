/**
 * The session cookie name, shared by the server client, the middleware and the
 * sign-out route. Kept in its own module so middleware never imports anything
 * that touches the React server runtime.
 */
export const SESSION_COOKIE = "orbit_session";
