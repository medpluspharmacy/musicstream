import { Response } from "express";

/** Thrown by controllers for expected failures; actions map it to a JSON error response. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function sendError(res: Response, err: unknown, label: string) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(`${label} error:`, err);
  res.status(500).json({ error: "Server error" });
}
