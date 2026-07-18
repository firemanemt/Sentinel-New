import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    path: "/",
    // NOVA's frontend and API are same-origin on Railway, so Lax is safer
    // than None and avoids browsers rejecting cookies if proxy headers vary.
    sameSite: "lax",
    // Behind Railway, Express may see req.protocol as http unless proxy headers
    // are trusted. Force secure in production because Railway serves HTTPS.
    secure: isProduction || isSecureRequest(req),
  };
}
