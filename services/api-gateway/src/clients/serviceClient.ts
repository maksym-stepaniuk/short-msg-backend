import { HttpError } from "../errors/httpError";

type QueryValue = string | number | boolean | null | undefined;

type ServiceRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  timeoutMs?: number;
};

type DownstreamError = {
  error?: unknown;
  code?: unknown;
  details?: unknown;
};

const defaultTimeoutMs = Number(process.env.SERVICE_REQUEST_TIMEOUT_MS ?? 5000);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const buildUrl = (baseUrl: string, path: string, query?: Record<string, QueryValue>) => {
  const url = new URL(path, baseUrl);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
};

const parseJson = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const normalizeDetails = (value: unknown, serviceName: string) => {
  if (value === null || Array.isArray(value) || isRecord(value)) {
    return value;
  }

  return {
    service: serviceName
  };
};

export class ServiceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceName: string
  ) {}

  async request<T>(options: ServiceRequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);

    try {
      const response = await fetch(buildUrl(this.baseUrl, options.path, options.query), {
        method: options.method ?? "GET",
        headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });

      const payload = await parseJson(response);

      if (!response.ok) {
        const downstream = isRecord(payload) ? (payload as DownstreamError) : {};

        throw new HttpError(
          response.status,
          typeof downstream.code === "string" ? downstream.code : "DOWNSTREAM_SERVICE_ERROR",
          typeof downstream.error === "string" ? downstream.error : `${this.serviceName} request failed`,
          normalizeDetails(downstream.details, this.serviceName)
        );
      }

      return payload as T;
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }

      if (err instanceof Error && err.name === "AbortError") {
        throw new HttpError(504, "DOWNSTREAM_TIMEOUT", `${this.serviceName} request timed out`, {
          service: this.serviceName
        });
      }

      throw new HttpError(502, "DOWNSTREAM_UNAVAILABLE", `${this.serviceName} is unavailable`, {
        service: this.serviceName
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
