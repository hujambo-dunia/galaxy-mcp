import { describe, it, expect, beforeEach } from "vitest";
import { searchIwcWorkflowsOp, searchIwcWorkflows } from "../../src/operations/search-iwc-workflows";
import { __resetIwcCacheForTest, __setIwcCacheForTest, type IwcWorkflow } from "../../src/iwc-manifest";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";
import { mockClient } from "../util/mock-client";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

const WF_RNA: IwcWorkflow = {
  trsID: "#workflow/github.com/iwc-workflows/rnaseq-pe/main",
  definition: {
    name: "RNA-Seq PE",
    annotation: "Paired-end RNA-seq differential expression analysis",
    tags: ["transcriptomics", "rnaseq"],
  },
  readme: "This workflow runs FastQC and HISAT2 for paired-end RNA-seq.",
};

const WF_ASSEM: IwcWorkflow = {
  trsID: "#workflow/github.com/iwc-workflows/assembly-ont/main",
  definition: {
    name: "ONT Assembly",
    annotation: "Oxford Nanopore genome assembly",
    tags: ["assembly", "nanopore"],
  },
  readme: "Assembles bacterial genomes from long reads.",
};

const WF_CHIPSEQ: IwcWorkflow = {
  trsID: "#workflow/github.com/iwc-workflows/chipseq/main",
  definition: {
    name: "ChIP-seq",
    annotation: "ChIP-seq peak calling",
    tags: ["epigenomics", "chipseq"],
  },
  readme: "Peak calling pipeline for ChIP-seq experiments.",
};

beforeEach(() => __resetIwcCacheForTest());

describe("search_iwc_workflows", () => {
  it("matches by name (case-insensitive)", async () => {
    __setIwcCacheForTest([WF_RNA, WF_ASSEM, WF_CHIPSEQ]);
    const ctx = ctxWith(mockClient({}));
    const out = await searchIwcWorkflows({ query: "rna" }, ctx);
    expect(out.map((w) => w.trsID)).toContain(WF_RNA.trsID);
    expect(out.map((w) => w.trsID)).not.toContain(WF_ASSEM.trsID);
  });

  it("matches by tag", async () => {
    __setIwcCacheForTest([WF_RNA, WF_ASSEM, WF_CHIPSEQ]);
    const ctx = ctxWith(mockClient({}));
    const out = await searchIwcWorkflows({ query: "nanopore" }, ctx);
    expect(out).toHaveLength(1);
    expect(out[0].trsID).toBe(WF_ASSEM.trsID);
  });

  it("matches by readme text", async () => {
    __setIwcCacheForTest([WF_RNA, WF_ASSEM, WF_CHIPSEQ]);
    const ctx = ctxWith(mockClient({}));
    const out = await searchIwcWorkflows({ query: "bacterial" }, ctx);
    expect(out).toHaveLength(1);
    expect(out[0].trsID).toBe(WF_ASSEM.trsID);
  });

  it("is case-insensitive", async () => {
    __setIwcCacheForTest([WF_RNA, WF_ASSEM, WF_CHIPSEQ]);
    const ctx = ctxWith(mockClient({}));
    const outUpper = await searchIwcWorkflows({ query: "RNA-SEQ" }, ctx);
    const outLower = await searchIwcWorkflows({ query: "rna-seq" }, ctx);
    expect(outUpper.map((w) => w.trsID)).toEqual(outLower.map((w) => w.trsID));
    expect(outLower.length).toBeGreaterThan(0);
  });

  it("returns empty array when nothing matches", async () => {
    __setIwcCacheForTest([WF_RNA, WF_ASSEM, WF_CHIPSEQ]);
    const ctx = ctxWith(mockClient({}));
    const out = await searchIwcWorkflows({ query: "zzz-no-match-zzz" }, ctx);
    expect(out).toHaveLength(0);
  });

  it("results are enriched (not raw)", async () => {
    __setIwcCacheForTest([WF_RNA]);
    const ctx = ctxWith(mockClient({}));
    const out = await searchIwcWorkflows({ query: "rna" }, ctx);
    expect(out[0]).toHaveProperty("readme_summary");
    expect(out[0]).toHaveProperty("tools_used");
    expect(out[0]).toHaveProperty("authors");
  });

  it("project message includes query and count", async () => {
    __setIwcCacheForTest([WF_RNA]);
    const out = await searchIwcWorkflows({ query: "rna" }, ctxWith(mockClient({})));
    const meta = searchIwcWorkflowsOp.project!(out, { query: "rna" });
    expect(meta.message).toBe(`1 IWC workflows matching "rna"`);
  });
});
