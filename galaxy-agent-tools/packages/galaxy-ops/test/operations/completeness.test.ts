import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "../../src/operations/all";
import { allOperations } from "../../src/operations/registry";

const EXPECTED = [
  "get_user", "run_tool", "get_invocations",
  "get_server_info", "get_histories", "list_history_ids", "get_history_details",
  "create_history", "get_dataset_details", "get_collection_details", "get_history_contents",
  "list_workflows", "get_workflow_details", "get_tool_details",
  "search_tools_by_name", "get_tool_panel", "get_tool_citations", "get_tool_run_examples",
  "search_tools_by_keywords",
  "get_job_details",
  "update_history",
  "cancel_workflow_invocation",
  "download_dataset",
  "get_iwc_workflows",
  "get_iwc_workflow_details",
  "search_iwc_workflows",
  "recommend_iwc_workflows",
  "import_workflow_from_iwc",
  "list_user_tools",
  "create_user_tool",
];

describe("registry completeness", () => {
  it("registers exactly the phase-1 op set (no missing, no extra)", () => {
    expect(allOperations.map((o) => o.name).sort()).toEqual([...EXPECTED].sort());
  });
  it("every registered op name exists in the external parity fixture", () => {
    const fixture: string[] = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../galaxy-mcp/test/fixtures/external-mcp-tools.json", import.meta.url)), "utf8"),
    );
    const set = new Set(fixture);
    const drift = allOperations.map((o) => o.name).filter((n) => !set.has(n));
    expect(drift, `ops not in fixture: ${drift.join(", ")}`).toEqual([]);
  });
});
