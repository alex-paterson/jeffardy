import { createServer, request as httpRequest, IncomingMessage, ServerResponse } from "http";

const NEXT_PORT = parseInt(process.env.PORT ?? "3000");
const TV_PORT = parseInt(process.env.TV_PORT ?? "3001");
const hostname = "0.0.0.0";

// Prevent crashes from unhandled socket errors
process.on("uncaughtException", (err) => {
  if ((err as NodeJS.ErrnoException).code === "ETIMEDOUT" ||
      (err as NodeJS.ErrnoException).code === "ECONNRESET" ||
      (err as NodeJS.ErrnoException).code === "EPIPE") {
    // Ignore network errors — TV client just reconnects
    return;
  }
  console.error("TV proxy error:", err);
});

function proxy(
  req: IncomingMessage,
  res: ServerResponse,
  targetPath: string
) {
  const proxyReq = httpRequest(
    {
      hostname: "127.0.0.1",
      port: NEXT_PORT,
      path: targetPath,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      proxyRes.on("error", () => {});
      try {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      } catch {
        // Response already sent
      }
    }
  );
  proxyReq.on("error", () => {
    try {
      res.writeHead(502);
      res.end("Next.js server not available");
    } catch {
      // Response already sent
    }
  });
  req.on("error", () => {});
  req.pipe(proxyReq, { end: true });
}

const tvServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const pathname = (req.url ?? "/").split("?")[0];
  const fullUrl = req.url ?? "/";

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/audio") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/tv") ||
    pathname.startsWith("/participant") ||
    /\.[a-z0-9]+$/i.test(pathname)  // any file with an extension (static assets)
  ) {
    proxy(req, res, fullUrl);
  } else {
    const tvPath = pathname === "/" ? "/tv" : `/tv${pathname}`;
    const search = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?")) : "";
    proxy(req, res, `${tvPath}${search}`);
  }
});

tvServer.on("upgrade", (req, socket, head) => {
  socket.on("error", () => {});

  const proxyReq = httpRequest({
    hostname: "127.0.0.1",
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    proxySocket.on("error", () => socket.destroy());
    socket.on("error", () => proxySocket.destroy());

    socket.write(
      `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
      Object.entries(proxyRes.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n") +
      "\r\n\r\n"
    );
    if (proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", () => socket.destroy());
  proxyReq.end();
});

tvServer.on("error", () => {});

tvServer.listen(TV_PORT, hostname, () => {
  console.log(`> TV mode ready on http://${hostname}:${TV_PORT}`);
});
