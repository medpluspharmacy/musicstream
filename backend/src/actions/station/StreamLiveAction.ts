import { Request, Response } from "express";
import { Readable } from "node:stream";
import { ADMIN_ROLES, verifyLiveToken } from "../../middlewares/auth.js";
import { User } from "../../models/index.js";
import StationController from "../../controllers/StationController.js";
import { fetchFromAzuraCast } from "../../lib/azuracast.js";
import { sendError } from "../../lib/http-error.js";

// How often an open stream re-checks that the listener and station are still allowed to play.
const RECHECK_MS = 30_000;

export async function liveListenerAllowed(token: unknown) {
  const claims = verifyLiveToken(token);
  if (!claims) return false;
  const u = await User.findByPk(claims.id, { attributes: ["id", "role", "approvalStatus", "tokenVersion", "isActive"] });
  return !!u && u.isActive !== false && u.tokenVersion === claims.tokenVersion
    && (ADMIN_ROLES.includes(u.role) || u.approvalStatus === "approved");
}

/**
 * Relays the connected AzuraCast station's audio to an approved listener, so
 * listeners never connect to AzuraCast directly. Auth is the signed `t` query token.
 */
export class StreamLiveAction {
  static async handle(req: Request, res: Response) {
    try {
      if (!(await liveListenerAllowed(req.query.t))) { res.status(403).json({ error: "Forbidden" }); return; }
      const target = await StationController.liveStreamTarget();
      if (!target) { res.status(409).json({ error: "The station isn't playing AzuraCast right now" }); return; }

      const abort = new AbortController();
      const { res: upstream, clearTimeout } = await fetchFromAzuraCast(target.nowPlaying.listenUrl, { signal: abort.signal });
      clearTimeout();
      const type = upstream.headers.get("content-type") ?? "";
      if (!upstream.ok || !upstream.body || !/^(audio\/|application\/ogg)/i.test(type)) {
        abort.abort();
        res.status(502).json({ error: "The AzuraCast stream isn't available" });
        return;
      }

      res.status(200);
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "no-store");
      res.flushHeaders();

      const body = Readable.fromWeb(upstream.body as any);
      const stop = () => {
        clearInterval(timer);
        abort.abort();
        body.destroy();
        if (!res.writableEnded) res.end();
      };
      const timer = setInterval(async () => {
        try {
          const state = await StationController.state();
          const stationOk = state.isLive && state.source === "azuracast";
          if (!stationOk || !(await liveListenerAllowed(req.query.t))) stop();
        } catch {
          // A transient DB error shouldn't cut everyone off; check again next time.
        }
      }, RECHECK_MS);
      req.on("close", stop);
      body.on("error", stop);
      body.on("end", stop);
      body.pipe(res);
    } catch (err) {
      if (res.headersSent) { res.end(); return; }
      sendError(res, err, "GET /station/live");
    }
  }
}
