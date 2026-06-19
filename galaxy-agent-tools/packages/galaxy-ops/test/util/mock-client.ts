import type { GalaxyClient } from "../../src/client";

type Resp = { data?: unknown; error?: unknown; response?: { status: number } };
type Handler = (path: string, init?: any) => Resp | Promise<Resp>;

/** Hand-rolled GalaxyClient stand-in. Ops call .GET/.POST/.PUT/.DELETE. */
export function mockClient(routes: {
  GET?: Handler;
  POST?: Handler;
  PUT?: Handler;
  DELETE?: Handler;
}): GalaxyClient {
  const fail = (m: string): Resp => ({ error: m, response: { status: 500 } });
  return {
    GET: async (p: string, i?: any) => (routes.GET ? routes.GET(p, i) : fail("no GET")),
    POST: async (p: string, i?: any) => (routes.POST ? routes.POST(p, i) : fail("no POST")),
    PUT: async (p: string, i?: any) => (routes.PUT ? routes.PUT(p, i) : fail("no PUT")),
    DELETE: async (p: string, i?: any) => (routes.DELETE ? routes.DELETE(p, i) : fail("no DELETE")),
  } as unknown as GalaxyClient;
}
