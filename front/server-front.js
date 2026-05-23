const http = require("http");
const fs = require("fs");
const path = require("path");
const { request: httpRequest } = require("http");

const FRONT_PORT = 8080;
const API_HOST = "localhost";
const API_PORT = 3000;

const CARS_DIR = path.join(__dirname, "carros");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
};

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/folders" && req.method === "GET") {
    try {
      const entries = fs.readdirSync(CARS_DIR, { withFileTypes: true });
      const folders = entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
      sendJSON(res, 200, { folders });
    } catch (e) {
      sendJSON(res, 500, { error: "Não foi possível ler a pasta carros/." });
    }
    return;
  }

  const folderMatch = req.url.match(/^\/folders\/([^/]+)$/);
  if (folderMatch && req.method === "GET") {
    const folder = decodeURIComponent(folderMatch[1]);
    const folderPath = path.join(CARS_DIR, folder);

    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      sendJSON(res, 404, { error: "Pasta não encontrada." });
      return;
    }

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const images = entries
        .filter(e => e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()))
        .map(e => e.name)
        .sort();
      sendJSON(res, 200, { folder, images });
    } catch (e) {
      sendJSON(res, 500, { error: "Erro ao ler a pasta." });
    }
    return;
  }

  const imageMatch = req.url.match(/^\/images\/([^/]+)\/([^/]+)$/);
  if (imageMatch && req.method === "GET") {
    const folder = decodeURIComponent(imageMatch[1]);
    const file   = decodeURIComponent(imageMatch[2]);
    const imgPath = path.join(CARS_DIR, folder, file);

    if (!imgPath.startsWith(CARS_DIR)) {
      res.writeHead(403);
      res.end("Acesso negado.");
      return;
    }

    fs.readFile(imgPath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Imagem não encontrada.");
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(data);
    });
    return;
  }

  if (req.url === "/infer" && req.method === "POST") {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: "/infer",
      method: "POST",
      headers: req.headers,
    };

    const proxy = httpRequest(options, (apiRes) => {
      res.writeHead(apiRes.statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      apiRes.pipe(res);
    });

    proxy.on("error", () => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: false,
        error: "API CNN não está rodando. Execute 'npm start' no projeto CNN."
      }));
    });

    req.pipe(proxy);
    return;
  }

  // ── Serve arquivos estáticos ──────────────────────────────────────────────
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 - Arquivo não encontrado: " + req.url);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(FRONT_PORT, () => {
  console.log("─────────────────────────────────────────");
  console.log("  Front-end rodando!");
  console.log(`  Acesse: http://localhost:${FRONT_PORT}`);
  console.log("─────────────────────────────────────────");
  console.log("  Certifique-se que a API CNN também");
  console.log("  está rodando (npm start) na porta 3000.");
  console.log("─────────────────────────────────────────");
});