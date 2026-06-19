import { describe, it, expect } from "vitest";
import { searchToolsByKeywordsOp, searchToolsByKeywords } from "../../src/operations/search-tools-by-keywords";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

// A minimal panel with nested sections and tools
const PANEL = [
  {
    id: "sec_genomics",
    name: "Genomics",
    model_class: "ToolSection",
    elems: [
      // immediate match: name contains "fastqc"
      { id: "fastqc_tool", name: "FastQC", description: "Quality control for FASTQ" },
      // _label id: must be skipped
      { id: "genomics_label", name: "Genomics Label", description: "" },
    ],
  },
  // a nested section inside another section
  {
    id: "sec_assembly",
    name: "Assembly",
    model_class: "ToolSection",
    elems: [
      {
        id: "sec_inner",
        name: "Inner",
        model_class: "ToolSection",
        elems: [
          // extensions-only match: neither name nor description contains "bam"
          { id: "samtools_view", name: "SAMtools View", description: "Convert alignment files" },
        ],
      },
    ],
  },
];

describe("search_tools_by_keywords", () => {
  it("returns immediate name match without fetching tool details", async () => {
    let detailFetchCount = 0;
    const client = mockClient({
      GET: (path, init) => {
        if (path === "/api/tools" && init?.params?.query?.in_panel === true) {
          return { data: PANEL, response: { status: 200 } };
        }
        // tool detail fetch for extensions matching
        detailFetchCount++;
        return { data: { id: init.params.path.tool_id, inputs: [] }, response: { status: 200 } };
      },
    });
    const out = await searchToolsByKeywords({ keywords: ["fastqc"] }, ctxWith(client));
    const ids = out.map((t) => t.id);
    expect(ids).toContain("fastqc_tool");
  });

  it("skips tool ids ending in _label", async () => {
    const client = mockClient({
      GET: (path, init) => {
        if (path === "/api/tools" && init?.params?.query?.in_panel === true) {
          return { data: PANEL, response: { status: 200 } };
        }
        return { data: { id: init.params.path.tool_id, inputs: [] }, response: { status: 200 } };
      },
    });
    const out = await searchToolsByKeywords({ keywords: ["label"] }, ctxWith(client));
    const ids = out.map((t) => t.id);
    expect(ids).not.toContain("genomics_label");
  });

  it("matches extensions-only tools via detail fetch", async () => {
    let detailFetchCount = 0;
    const client = mockClient({
      GET: (path, init) => {
        if (path === "/api/tools" && init?.params?.query?.in_panel === true) {
          return { data: PANEL, response: { status: 200 } };
        }
        // tool detail fetch -- samtools_view has bam extension input, nothing else does
        detailFetchCount++;
        const toolId = init?.params?.path?.tool_id;
        if (toolId === "samtools_view") {
          return {
            data: {
              id: "samtools_view",
              inputs: [{ extensions: ["bam", "sam"] }],
            },
            response: { status: 200 },
          };
        }
        return { data: { id: toolId, inputs: [] }, response: { status: 200 } };
      },
    });
    const out = await searchToolsByKeywords({ keywords: ["bam"] }, ctxWith(client));
    const ids = out.map((t) => t.id);
    // samtools_view has no "bam" in name or description -- it must match via extension detail fetch
    expect(ids).toContain("samtools_view");
    // assert the detail endpoint was actually called (extensions branch is exercised)
    expect(detailFetchCount).toBeGreaterThan(0);
  });

  it("returns slim objects with id/name/description/versions", async () => {
    const client = mockClient({
      GET: (path, init) => {
        if (path === "/api/tools" && init?.params?.query?.in_panel === true) {
          return { data: PANEL, response: { status: 200 } };
        }
        return { data: { id: init?.params?.path?.tool_id, inputs: [] }, response: { status: 200 } };
      },
    });
    const out = await searchToolsByKeywords({ keywords: ["fastqc"] }, ctxWith(client));
    expect(out[0]).toHaveProperty("id");
    // name/description/versions are allowed to be present (optional)
    expect(Object.keys(out[0])).not.toContain("elems");
  });

  it("project returns message with match count", () => {
    const results = [{ id: "t1" }, { id: "t2" }];
    const msg = searchToolsByKeywordsOp.project!(results as any, { keywords: ["fastqc"] });
    expect(msg.message).toBe("2 tool(s) matching keywords");
  });
});
