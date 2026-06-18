import { describe, it, expect } from "vitest";
import { getToolPanelOp, getToolPanel } from "../../src/operations/get-tool-panel";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import { GalaxyNotFoundError } from "../../src/errors";
import type { GalaxyContext } from "../../src/context";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

const PANEL = [
  { id: "section1", name: "Genomics", model_class: "ToolSection", elems: [{ id: "fastqc" }] },
  { id: "section2", name: "Assembly", model_class: "ToolSection", elems: [] },
];

describe("get_tool_panel", () => {
  it("fetches panel via in_panel=true and returns verbatim", async () => {
    const client = mockClient({
      GET: (path, init) => {
        expect(path).toBe("/api/tools");
        expect(init.params.query.in_panel).toBe(true);
        return { data: PANEL, response: { status: 200 } };
      },
    });
    const out = await getToolPanel({}, ctxWith(client));
    expect(out).toEqual(PANEL);
  });

  it("throws GalaxyNotFoundError on 404", async () => {
    const client = mockClient({
      GET: () => ({ error: { err_msg: "not found" }, response: { status: 404 } }),
    });
    await expect(getToolPanel({}, ctxWith(client))).rejects.toBeInstanceOf(GalaxyNotFoundError);
  });

  it("project returns 'Tool panel'", () => {
    const msg = getToolPanelOp.project!(PANEL as any, {});
    expect(msg.message).toBe("Tool panel");
  });
});
