const http = require("http");
const { randomUUID } = require("crypto");

const port = Number(process.env.WORKER_SERVICE_PORT ?? 3003);
const queue = [];
let processing = false;

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (chunks.length === 0) {
      resolve({});
      return;
    }

    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (err) {
      reject(err);
    }
  });

  req.on("error", reject);
});

const processQueue = () => {
  if (processing) {
    return;
  }

  processing = true;

  setImmediate(() => {
    while (queue.length > 0) {
      const job = queue.shift();

      console.log(`[worker] processed job type=${job.type} id=${job.id} createdAt=${job.createdAt}`);
    }

    processing = false;
  });
};

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "worker-service",
      queuedJobs: queue.length
    });
    return;
  }

  if (req.method === "POST" && req.url === "/jobs") {
    try {
      const payload = await readJsonBody(req);
      const job = {
        id: typeof payload.id === "string" ? payload.id : randomUUID(),
        type: typeof payload.type === "string" ? payload.type : "unknown",
        payload: payload.payload ?? {},
        createdAt: new Date().toISOString()
      };

      queue.push(job);
      console.log(`[worker] queued job type=${job.type} id=${job.id}`);
      processQueue();

      sendJson(res, 202, {
        status: "queued",
        id: job.id,
        type: job.type
      });
    } catch {
      sendJson(res, 400, {
        error: "Invalid JSON body",
        code: "INVALID_JSON"
      });
    }
    return;
  }

  sendJson(res, 404, {
    error: "Route not found",
    code: "ROUTE_NOT_FOUND"
  });
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(port, () => {
  console.log(`worker-service listening on port ${port}`);
});
