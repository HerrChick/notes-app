import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import { handleApiRequest } from './router'
import { ensureMigrated } from './db/migrate'

// Load env vars from repo root `.env` first, then allow `api/.env` to override.
const here = path.dirname(fileURLToPath(import.meta.url)) // api/src
dotenv.config({ path: path.resolve(here, '../../.env') })
dotenv.config({ path: path.resolve(here, '../.env') })

const port = Number(process.env.PORT || 8787)

await ensureMigrated()

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.headers.host) {
      res.statusCode = 400
      res.end('Bad Request')
      return
    }

    const url = new URL(req.url, `http://${req.headers.host}`)
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    await new Promise<void>((resolve) => req.on('end', () => resolve()))

    const body = chunks.length ? Buffer.concat(chunks) : undefined
    const request = new Request(url.toString(), {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: body ? body : undefined,
    })

    const response = await handleApiRequest(request)
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    const text = await response.text()
    res.end(text)
  } catch (err) {
    res.statusCode = 500
    res.end('Internal Server Error')
    console.error(err)
  }
})

server.listen(port, () => {
  console.log(`API dev server listening on http://localhost:${port}`)
})

