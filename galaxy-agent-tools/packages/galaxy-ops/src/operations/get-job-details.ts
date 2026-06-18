import { z } from "zod";
import type { GetJson } from "../bindings";
import type { GalaxyContext } from "../context";
import { classifyHttp } from "../errors";
import { register } from "./registry";
import type { AnyOperation, Operation } from "./types";

// The provenance endpoint's job_id field is not always typed; hand-type for safety.
interface ProvenanceResponse {
  job_id?: string;
  [key: string]: unknown;
}

// Similarly, the dataset endpoint's creating_job field.
interface DatasetMeta {
  creating_job?: string;
  [key: string]: unknown;
}

export interface JobDetail {
  id?: string;
  state?: string;
  [key: string]: unknown;
}

export interface GetJobDetailsResult {
  job: JobDetail;
  dataset_id: string;
  job_id: string;
}

const input = {
  datasetId: z.string().describe("dataset (HDA) id"),
  historyId: z.string().optional().describe("history id; speeds provenance lookup"),
};
type In = { datasetId: string; historyId?: string };

async function run(i: In, ctx: GalaxyContext): Promise<GetJobDetailsResult> {
  let jobId: string | undefined;

  // Try provenance path if historyId supplied
  if (i.historyId) {
    const { data, error, response } = await ctx.client.GET(
      "/api/histories/{history_id}/contents/{dataset_id}/provenance",
      { params: { path: { history_id: i.historyId, dataset_id: i.datasetId } } },
    );
    if (!error && data) {
      jobId = (data as ProvenanceResponse).job_id;
    } else if (response.status >= 500) {
      throw classifyHttp(response.status, error);
    }
    // non-fatal: fall through to dataset lookup if provenance didn't yield a job_id
  }

  // Fallback: read creating_job from dataset metadata
  if (!jobId) {
    const { data, error, response } = await ctx.client.GET("/api/datasets/{dataset_id}", {
      params: { path: { dataset_id: i.datasetId } },
    });
    if (error || !data) throw classifyHttp(response.status, error);
    jobId = (data as DatasetMeta).creating_job;
    if (!jobId) throw classifyHttp(404, { err_msg: `No job found for dataset ${i.datasetId}` });
  }

  const { data: jobData, error: jobError, response: jobResp } = await ctx.client.GET("/api/jobs/{job_id}", {
    params: { path: { job_id: jobId } },
  });
  if (jobError || !jobData) throw classifyHttp(jobResp.status, jobError);

  return {
    job: jobData as JobDetail,
    dataset_id: i.datasetId,
    job_id: jobId,
  };
}

export const getJobDetailsOp: Operation<typeof input, GetJobDetailsResult> = {
  name: "get_job_details",
  domain: "jobs",
  summary: "Get job details for the job that produced a dataset.",
  input,
  run,
  project: (out) => ({ message: `Job ${out.job_id} for dataset ${out.dataset_id}` }),
};

register(getJobDetailsOp as AnyOperation);

export const getJobDetails = (i: In, ctx: GalaxyContext) => getJobDetailsOp.run(i, ctx);
