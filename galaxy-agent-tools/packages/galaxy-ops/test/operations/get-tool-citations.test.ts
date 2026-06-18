import { describe, it, expect } from "vitest";
import { getToolCitationsOp, getToolCitations } from "../../src/operations/get-tool-citations";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

describe("get_tool_citations", () => {
  it("fetches tool show payload and maps name/version/citations", async () => {
    const client = mockClient({
      GET: (path, init) => {
        expect(path).toBe("/api/tools/{tool_id}");
        expect(init.params.path.tool_id).toBe("fastqc");
        expect(init.params.query.io_details).toBe(false);
        expect(init.params.query.link_details).toBe(false);
        return {
          data: { id: "fastqc", name: "FastQC", version: "0.74", citations: [{ type: "doi", value: "10.1/foo" }] },
          response: { status: 200 },
        };
      },
    });
    const out = await getToolCitations({ toolId: "fastqc" }, ctxWith(client));
    expect(out.tool_name).toBe("FastQC");
    expect(out.tool_version).toBe("0.74");
    expect(out.citations).toHaveLength(1);
  });

  it("defaults citations to [] when missing from payload", async () => {
    const client = mockClient({
      GET: () => ({ data: { id: "cat1", name: "Concatenate" }, response: { status: 200 } }),
    });
    const out = await getToolCitations({ toolId: "cat1" }, ctxWith(client));
    expect(out.citations).toEqual([]);
  });

  it("project message includes citation count and tool name", () => {
    const result = { tool_name: "FastQC", tool_version: "0.74", citations: [{}] };
    const msg = getToolCitationsOp.project!(result as any, { toolId: "fastqc" });
    expect(msg.message).toBe("1 citation(s) for FastQC");
  });

  it("project falls back to toolId when tool_name is absent", () => {
    const result = { citations: [] };
    const msg = getToolCitationsOp.project!(result as any, { toolId: "cat1" });
    expect(msg.message).toBe("0 citation(s) for cat1");
  });
});
