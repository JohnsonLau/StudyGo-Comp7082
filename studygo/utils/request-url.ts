/** Preserve the browser's host when Next.js uses an internal server URL. */
export function getRequestUrl(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) {
    url.host = host;
  }
  return url;
}
