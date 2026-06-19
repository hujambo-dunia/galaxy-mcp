import { describe, it, expect } from "vitest";
import { listUserToolsOp, listUserTools } from "../../src/operations/list-user-tools";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

const TOOLS = [
  { id: "1", uuid: "aaaa", tool_id: "my_tool/0.1.0", active: true },
  { id: "2", uuid: "bbbb", tool_id: "other_tool/0.1.0", active: true },
];

describe("list_user_tools", () => {
  it("GETs /api/unprivileged_tools with active:true by default", async () => {
    const client = mockClient({
      GET: (path, init) => {
        expect(path).toBe("/api/unprivileged_tools");
        expect(init.params.query.active).toBe(true);
        return { data: TOOLS, response: { status: 200 } };
      },
    });
    const out = await listUserTools({}, ctxWith(client));
    expect(out).toHaveLength(2);
    expect(out[0].uuid).toBe("aaaa");
  });

  it("passes active:false when explicitly set", async () => {
    const client = mockClient({
      GET: (path, init) => {
        expect(init.params.query.active).toBe(false);
        return { data: [], response: { status: 200 } };
      },
    });
    const out = await listUserTools({ active: false }, ctxWith(client));
    expect(out).toHaveLength(0);
  });

  it("projects the count message", () => {
    expect(listUserToolsOp.project!(TOOLS, {})).toEqual({ message: "2 user-defined tool(s)" });
  });

  it("throws on HTTP error", async () => {
    const client = mockClient({
      GET: () => ({ error: "server error", response: { status: 500 } }),
    });
    await expect(listUserTools({}, ctxWith(client))).rejects.toThrow();
  });
});
