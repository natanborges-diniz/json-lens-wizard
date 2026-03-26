import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, '../../');

function readJsonSafe(p: string) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readTextSafe(p: string) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (url.pathname === '/health') {
    res.end(JSON.stringify({ ok: true, service: 'json-lens-wizard-mcp', phase: 1 }));
    return;
  }

  if (url.pathname === '/project-status') {
    const data = readTextSafe(path.join(ROOT, 'docs/PROJECT_STATUS.md'));
    res.end(JSON.stringify({ ok: true, data }));
    return;
  }

  if (url.pathname === '/normalized-data') {
    const families = readJsonSafe(path.join(ROOT, 'data/normalized/families-comparison-table.json'));
    const materials = readJsonSafe(path.join(ROOT, 'data/normalized/materials-canonical-map.json'));
    const treatments = readJsonSafe(path.join(ROOT, 'data/normalized/treatments-canonical-map.json'));
    const benefits = readJsonSafe(path.join(ROOT, 'data/normalized/family-benefits-table.json'));
    res.end(JSON.stringify({ ok: true, families, materials, treatments, benefits }));
    return;
  }

  if (url.pathname === '/supplier-docs') {
    const essilor = readTextSafe(path.join(ROOT, 'docs/suppliers/essilor-ago-2025-extraction.md'));
    const hoya = readTextSafe(path.join(ROOT, 'docs/suppliers/hoya-abr-2025-extraction.md'));
    const zeiss = readTextSafe(path.join(ROOT, 'docs/suppliers/zeiss-abr-2025-extraction.md'));
    res.end(JSON.stringify({ ok: true, essilor, hoya, zeiss }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`json-lens-wizard-mcp listening on ${PORT}`);
});
