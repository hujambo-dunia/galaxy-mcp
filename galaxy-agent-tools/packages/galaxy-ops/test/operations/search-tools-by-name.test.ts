import { describe, it, expect } from "vitest";
import { searchToolsByNameOp, searchToolsByName } from "../../src/operations/search-tools-by-name";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

const TOOLS = [
  { id: "fastqc_tool", name: "FastQC", description: "Quality control" },
  { id: "trimmomatic", name: "Trimmomatic", description: "Trimming reads" },
  // id-only match fixture: name/description intentionally contain no part of the id
  { id: "toolxyz_internal_id", name: "Read Processor", description: "Processes sequencing reads" },
  { id: "cat1", name: "Concatenate", description: "Join files together" },
];

describe("search_tools_by_name", () => {
  it("sends in_panel=false and filters by name substring (case-insensitive)", async () => {
    const client = mockClient({
      GET: (path, init) => {
        expect(path).toBe("/api/tools");
        expect(init.params.query.in_panel).toBe(false);
        return { data: TOOLS, response: { status: 200 } };
      },
    });
    const out = await searchToolsByName({ query: "fastqc" }, ctxWith(client));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("fastqc_tool");
  });

  it("matches against id when name/description do not match", async () => {
    const client = mockClient({
      GET: () => ({ data: TOOLS, response: { status: 200 } }),
    });
    // "toolxyz_internal_id" contains "toolxyz" -- the name ("Read Processor") and
    // description ("Processes sequencing reads") have no substring match, so this
    // exercises the id-only branch exclusively
    const out = await searchToolsByName({ query: "toolxyz" }, ctxWith(client));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("toolxyz_internal_id");
  });

  it("matches against description (case-insensitive)", async () => {
    const client = mockClient({
      GET: () => ({ data: TOOLS, response: { status: 200 } }),
    });
    const out = await searchToolsByName({ query: "join files" }, ctxWith(client));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("cat1");
  });

  it("returns empty array when no match", async () => {
    const client = mockClient({
      GET: () => ({ data: TOOLS, response: { status: 200 } }),
    });
    const out = await searchToolsByName({ query: "zzznomatch" }, ctxWith(client));
    expect(out).toHaveLength(0);
  });

  it("throws on 500 error", async () => {
    const client = mockClient({
      GET: () => ({ error: { err_msg: "server error" }, response: { status: 500 } }),
    });
    await expect(searchToolsByName({ query: "anything" }, ctxWith(client))).rejects.toThrow();
  });

  it("project returns message with count and query", () => {
    const tools = [{ id: "t1", name: "Tool" }];
    const msg = searchToolsByNameOp.project(tools as any, { query: "tool" });
    expect(msg.message).toBe('1 tool(s) matching "tool"');
  });
});
