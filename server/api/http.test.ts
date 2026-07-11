import { Readable } from "node:stream"
import { describe, expect, it } from "vitest"

import {
  HttpError,
  getQueryParam,
  readJsonBody,
  requireMethod,
  requireUser,
  type ApiRequest,
} from "./http.js"

function request(input: {
  body?: string
  headers?: Record<string, string>
  method?: string
  query?: Record<string, string | string[]>
  url?: string
} = {}) {
  const stream = Readable.from(input.body ? [input.body] : []) as ApiRequest
  stream.headers = input.headers ?? {}
  stream.method = input.method
  stream.query = input.query
  stream.url = input.url
  return stream
}

describe("HTTP API helpers", () => {
  it("rejects an unexpected method", () => {
    expect(() => requireMethod(request({ method: "GET" }), "POST")).toThrowError(
      new HttpError(405, "Use POST for this endpoint."),
    )
  })

  it("rejects a request without an identity header", () => {
    expect(() => requireUser(request())).toThrowError(
      new HttpError(401, "Sign in to manage assignment files."),
    )
  })

  it("reads query values from explicit query data and the request URL", () => {
    expect(getQueryParam(request({ query: { team: ["4", "5"] } }), "team")).toBe("4")
    expect(getQueryParam(request({ url: "/api/files?assignment=12" }), "assignment")).toBe(
      "12",
    )
  })

  it("rejects malformed JSON", async () => {
    await expect(readJsonBody(request({ body: "{not-json" }))).rejects.toMatchObject({
      statusCode: 400,
      message: "Request body must be valid JSON.",
    })
  })
})
