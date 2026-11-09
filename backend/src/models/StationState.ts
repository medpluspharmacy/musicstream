import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

export type StationSource = "playlist" | "azuracast";

class StationState extends Model {
  declare id: number;
  declare isLive: boolean;
  declare startedAt: Date | null;
  declare source: StationSource;
  declare azuracastUrl: string | null;
  declare azuracastStation: string | null;
  declare azuracastApiKey: string | null;
  declare crossfadeSeconds: number;
  declare gapless: boolean;
  declare updatedAt: Date;
}

StationState.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    isLive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_live" },
    startedAt: { type: DataTypes.DATE, field: "started_at" },
    source: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "playlist" },
    azuracastUrl: { type: DataTypes.STRING(500), field: "azuracast_url" },
    azuracastStation: { type: DataTypes.STRING(100), field: "azuracast_station" },
    azuracastApiKey: { type: DataTypes.TEXT, field: "azuracast_api_key" },
    crossfadeSeconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "crossfade_seconds" },
    gapless: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "station_state", timestamps: false }
);

export default StationState;
