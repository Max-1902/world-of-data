// The (req, res) types the api/ handlers are written against: the part of Vercel's Node helpers they use.
// Declared here rather than installing @vercel/node, whose runtime dependencies carry known vulnerabilities
// and which this project never runs: the handlers are served by vite.api-dev.ts and desktop/apiBridge.ts.
declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'node:http'

  export interface VercelRequest extends IncomingMessage {
    query: { [key: string]: string | string[] }
    cookies: { [key: string]: string }
    body: any
  }

  export interface VercelResponse extends ServerResponse {
    send(body: unknown): VercelResponse
    json(body: unknown): VercelResponse
    status(statusCode: number): VercelResponse
  }
}
