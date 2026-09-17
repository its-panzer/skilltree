import { timingSafeEqual } from "node:crypto";
export function tokenMatches(value, expected) {
  if (!value || !expected) return false;
  const a = Buffer.from(value),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function access(req, config) {
  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  let host;
  try {
    host = new URL(`http://${req.headers.host}`).hostname;
  } catch {
    return { allowed: false, reason: "Invalid host" };
  }
  const publicHost = config.publicOrigin
    ? new URL(config.publicOrigin).hostname
    : null;
  if (!localHosts.has(host) && host !== publicHost)
    return { allowed: false, reason: "Host is not allowed" };
  const allowedOrigins = new Set(
    [
      `http://127.0.0.1:${config.port}`,
      `http://localhost:${config.port}`,
      config.publicOrigin,
    ].filter(Boolean),
  );
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin))
    return { allowed: false, reason: "Origin is not allowed" };
  const bearer = /^Bearer (.+)$/i.exec(req.headers.authorization || "")?.[1];
  const authenticated = tokenMatches(bearer, config.token);
  const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
    req.socket.remoteAddress,
  );
  const local = loopback && localHosts.has(host);
  const tailnet =
    loopback &&
    host === publicHost &&
    config.tailscaleLogin &&
    req.headers["tailscale-user-login"] === config.tailscaleLogin;
  return { allowed: true, authenticated, local, tailnet };
}
