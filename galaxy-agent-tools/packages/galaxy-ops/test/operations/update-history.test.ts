import { describe, it, expect } from "vitest";
import { updateHistoryOp, updateHistory } from "../../src/operations/update-history";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";
import { GalaxyConnectionError } from "../../src/errors";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

describe("update_history", () => {
  it("is a write op", () => {
    expect(updateHistoryOp.readOnly).toBe(false);
  });

  it("sends only provided fields in PUT body", async () => {
    const client = mockClient({
      PUT: (path, init) => {
        expect(path).toBe("/api/histories/{history_id}");
        expect(init.params.path.history_id).toBe("h1");
        // only name should be in the body, not annotation
        expect(init.body.name).toBe("New Name");
        expect(init.body.annotation).toBeUndefined();
        return { data: { id: "h1", name: "New Name" }, response: { status: 200 } };
      },
    });
    const out = await updateHistory({ historyId: "h1", name: "New Name" }, ctxWith(client));
    expect((out as any).id).toBe("h1");
  });

  it("throws GalaxyConnectionError when no fields to update", async () => {
    const client = mockClient({
      PUT: () => ({ data: {}, response: { status: 200 } }),
    });
    await expect(updateHistory({ historyId: "h1" }, ctxWith(client))).rejects.toThrow(GalaxyConnectionError);
  });

  it("sends tags and deleted when provided", async () => {
    const client = mockClient({
      PUT: (_path, init) => {
        expect(init.body.tags).toEqual(["tag1", "tag2"]);
        expect(init.body.deleted).toBe(true);
        return { data: { id: "h2" }, response: { status: 200 } };
      },
    });
    await updateHistory({ historyId: "h2", tags: ["tag1", "tag2"], deleted: true }, ctxWith(client));
  });
});
