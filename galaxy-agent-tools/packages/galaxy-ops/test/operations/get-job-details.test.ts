import { describe, it, expect } from "vitest";
import { getJobDetailsOp, getJobDetails } from "../../src/operations/get-job-details";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";
import { GalaxyNotFoundError } from "../../src/errors";

const ctxWith = (client: any): GalaxyContext => ({ client, poll: DEFAULT_POLL });

describe("get_job_details", () => {
  it("(a) historyId path: resolves job_id from provenance then fetches job", async () => {
    const client = mockClient({
      GET: (path, _init) => {
        if (path.includes("/provenance")) {
          return { data: { job_id: "j1" }, response: { status: 200 } };
        }
        if (path.includes("/jobs/")) {
          return { data: { id: "j1", state: "ok" }, response: { status: 200 } };
        }
        return { error: "not found", response: { status: 404 } };
      },
    });
    const out = await getJobDetails({ datasetId: "d1", historyId: "h1" }, ctxWith(client));
    expect(out.job_id).toBe("j1");
    expect(out.dataset_id).toBe("d1");
    expect((out.job as any).id).toBe("j1");
    expect((out.job as any).state).toBe("ok");
  });

  it("(b) fallback path: no historyId, reads creating_job from dataset GET", async () => {
    const client = mockClient({
      GET: (path, _init) => {
        if (path.includes("/datasets/") && !path.includes("/jobs/")) {
          return { data: { creating_job: "j2" }, response: { status: 200 } };
        }
        if (path.includes("/jobs/")) {
          return { data: { id: "j2" }, response: { status: 200 } };
        }
        return { error: "not found", response: { status: 404 } };
      },
    });
    const out = await getJobDetails({ datasetId: "d2" }, ctxWith(client));
    expect(out.job_id).toBe("j2");
    expect(out.dataset_id).toBe("d2");
  });

  it("(c) error: dataset GET returns 404 -> throws", async () => {
    const client = mockClient({
      GET: (_path, _init) => {
        return { error: "not found", response: { status: 404 } };
      },
    });
    await expect(getJobDetails({ datasetId: "d3" }, ctxWith(client))).rejects.toThrow();
  });
});
