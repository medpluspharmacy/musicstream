import StationController from "./StationController.js";
import { PlaylistItem } from "../models/index.js";
import { encryptSecret } from "../lib/secret-cipher.js";
import { clearAzuraCastCache, getNowPlaying, normalizeBaseUrl, normalizeStation } from "../lib/azuracast.js";

export default class IntegrationController {
  /** Connection details for the admin UI. The API key itself is never returned. */
  static async getAzuraCast() {
    const state = await StationController.state();
    if (!state.azuracastUrl) return { connected: false, baseUrl: null, station: null, hasApiKey: false };
    return { connected: true, baseUrl: state.azuracastUrl, station: state.azuracastStation, hasApiKey: !!state.azuracastApiKey };
  }

  /**
   * Saves the connection after checking it works. Leaving `apiKey` out keeps
   * the stored key, unless the server address changed (the key belongs to the
   * old server), and an empty string removes it.
   */
  static async saveAzuraCast(input: { baseUrl: unknown; station: unknown; apiKey?: unknown }) {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const station = normalizeStation(input.station);
    const state = await StationController.state();
    let apiKey: string | null;
    if (typeof input.apiKey === "string") apiKey = input.apiKey.trim() || null;
    else if (state.azuracastApiKey && state.azuracastUrl === baseUrl) apiKey = StationController.azuracastConfig(state)!.apiKey;
    else apiKey = null;

    const preview = await getNowPlaying({ baseUrl, station, apiKey }, { fresh: true });

    state.azuracastUrl = baseUrl;
    state.azuracastStation = station;
    state.azuracastApiKey = apiKey ? encryptSecret(apiKey) : null;
    state.updatedAt = new Date();
    await state.save();
    clearAzuraCastCache();
    return {
      ...(await IntegrationController.getAzuraCast()),
      preview: { stationName: preview.stationName, title: preview.title, artist: preview.artist },
    };
  }

  /** Disconnects AzuraCast. If the station was playing it, it falls back to the playlist, or goes off air if that's empty. */
  static async removeAzuraCast() {
    const state = await StationController.state();
    if (state.source === "azuracast") {
      state.source = "playlist";
      if (state.isLive) {
        if ((await PlaylistItem.count()) > 0) state.startedAt = new Date();
        else { state.isLive = false; state.startedAt = null; }
      }
    }
    state.azuracastUrl = null;
    state.azuracastStation = null;
    state.azuracastApiKey = null;
    state.updatedAt = new Date();
    await state.save();
    clearAzuraCastCache();
    return IntegrationController.getAzuraCast();
  }
}
