import { describe, it, expect } from "vitest";
import { legacyGet, legacyPost, legacyDelete } from "../src/legacy";
import { mockClient } from "./util/mock-client";
import { DEFAULT_POLL } from "../src/context";
import { GalaxyNotFoundError } from "../src/errors";
import type { GalaxyContext } from "../src/context";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

describe("legacyGet", () => {
  it("returns the data for an off-schema path via the configured client", async () => {
    const client = mockClient({
      GET: (path) => {
        expect(path).toBe("/api/tools/{tool_id}");
        return { data: { id: "cat1", name: "Concatenate" }, response: { status: 200 } };
      },
    });
    const out = await legacyGet<{ id: string }>(ctxWith(client), "/api/tools/{tool_id}", {
      params: { path: { tool_id: "cat1" } },
    });
    expect(out.id).toBe("cat1");
  });

  it("classifies HTTP failures into typed errors", async () => {
    const client = mockClient({ GET: () => ({ error: { err_msg: "no" }, response: { status: 404 } }) });
    await expect(legacyGet(ctxWith(client), "/api/tools/{tool_id}", {})).rejects.toBeInstanceOf(GalaxyNotFoundError);
  });
});

describe("legacyPost", () => {
  it("returns data for an off-schema POST and classifies failures", async () => {
    const ok = mockClient({
      POST: (path, init) => {
        expect(path).toBe("/api/unprivileged_tools");
        expect(init.body.src).toBe("representation");
        return { data: { id: "t1", uuid: "u1" }, response: { status: 200 } };
      },
    });
    const out = await legacyPost<{ uuid: string }>(ctxWith(ok), "/api/unprivileged_tools", {
      body: { src: "representation" },
    });
    expect(out.uuid).toBe("u1");

    const bad = mockClient({ POST: () => ({ error: { err_msg: "no" }, response: { status: 404 } }) });
    await expect(legacyPost(ctxWith(bad), "/api/unprivileged_tools", {})).rejects.toBeInstanceOf(
      GalaxyNotFoundError,
    );
  });
});

describe("legacyDelete", () => {
  it("returns data for an off-schema DELETE and classifies failures", async () => {
    const ok = mockClient({
      DELETE: (path) => {
        expect(path).toBe("/api/unprivileged_tools/{uuid}");
        return { data: { uuid: "u1", deactivated: true }, response: { status: 200 } };
      },
    });
    const out = await legacyDelete<{ deactivated: boolean }>(ctxWith(ok), "/api/unprivileged_tools/{uuid}", {
      params: { path: { uuid: "u1" } },
    });
    expect(out.deactivated).toBe(true);

    const bad = mockClient({ DELETE: () => ({ error: { err_msg: "no" }, response: { status: 404 } }) });
    await expect(legacyDelete(ctxWith(bad), "/api/unprivileged_tools/{uuid}", {})).rejects.toBeInstanceOf(
      GalaxyNotFoundError,
    );
  });

  it("treats a 204 No Content (null body) as success, not an error", async () => {
    const noContent = mockClient({ DELETE: () => ({ data: undefined, response: { status: 204 } }) });
    await expect(
      legacyDelete(ctxWith(noContent), "/api/unprivileged_tools/{uuid}", {}),
    ).resolves.toBeUndefined();
  });
});
