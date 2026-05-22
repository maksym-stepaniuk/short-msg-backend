type WorkerJobPayload = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

type WorkerJobResponse = {
  status: "queued";
  id: string;
  type: string;
};

const workerServiceUrl = process.env.WORKER_SERVICE_URL;
const workerTimeoutMs = Number(process.env.WORKER_REQUEST_TIMEOUT_MS ?? 1000);

export const enqueueWorkerJob = async (job: WorkerJobPayload) => {
  if (!workerServiceUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), workerTimeoutMs);

  try {
    const response = await fetch(new URL("/jobs", workerServiceUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(job),
      signal: controller.signal
    });

    if (!response.ok) {
      console.error(`worker-service rejected job ${job.id}: ${response.status}`);
      return false;
    }

    const payload = await response.json() as WorkerJobResponse;
    return payload.status === "queued";
  } catch (err) {
    console.error(`worker-service unavailable for job ${job.id}`, err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
};
