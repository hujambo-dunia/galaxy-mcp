import { describe, it, expect, vi } from "vitest";
import { getJobDetailsOp, getJobDetails } from "../../src/operations/get-job-details";
import { mockClient } from "../util/mock-client";
import { DEFAULT_POLL } from "../../src/context";
import type { GalaxyContext } from "../../src/context";
import { GalaxyNotFoundError, GalaxyAuthError } from "../../src/errors";

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

  it("(b) fallback path: no historyId, reads creating_job from dataset GET; provenance not called", async () => {
    let provenanceCalls = 0;
    const client = mockClient({
      GET: (path, _init) => {
        if (path.includes("/provenance")) {
          provenanceCalls++;
          return { data: { job_id: "should-not-use" }, response: { status: 200 } };
        }
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
    expect(provenanceCalls).toBe(0);
  });

  it("(c) error: dataset GET returns 404 -> throws", async () => {
    const client = mockClient({
      GET: (_path, _init) => {
        return { error: "not found", response: { status: 404 } };
      },
    });
    await expect(getJobDetails({ datasetId: "d3" }, ctxWith(client))).rejects.toThrow();
  });

  it("(d) historyId given, provenance returns 403 -> op rejects (does not silently fall through)", async () => {
    const client = mockClient({
      GET: (path, _init) => {
        if (path.includes("/provenance")) {
          return { error: { err_msg: "Forbidden" }, response: { status: 403 } };
        }
        // dataset and job paths should NOT be reached
        return { data: { creating_job: "j-should-not-reach" }, response: { status: 200 } };
      },
    });
    await expect(getJobDetails({ datasetId: "d4", historyId: "h4" }, ctxWith(client))).rejects.toBeInstanceOf(GalaxyAuthError);
  });

  it("(e) historyId given, provenance returns 200 but no job_id -> falls through to dataset creating_job", async () => {
    const client = mockClient({
      GET: (path, _init) => {
        if (path.includes("/provenance")) {
          // 200 response with no job_id field
          return { data: { some_other_field: "x" }, response: { status: 200 } };
        }
        if (path.includes("/datasets/") && !path.includes("/jobs/")) {
          return { data: { creating_job: "j5" }, response: { status: 200 } };
        }
        if (path.includes("/jobs/")) {
          return { data: { id: "j5", state: "ok" }, response: { status: 200 } };
        }
        return { error: "not found", response: { status: 404 } };
      },
    });
    const out = await getJobDetails({ datasetId: "d5", historyId: "h5" }, ctxWith(client));
    expect(out.job_id).toBe("j5");
    expect(out.dataset_id).toBe("d5");
  });
});
