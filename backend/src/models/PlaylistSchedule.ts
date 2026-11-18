import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

/** One playlist in a day's queue. Day 0 = Sunday ... 6 = Saturday; 7 = the default queue. */
class PlaylistSchedule extends Model {
  declare id: number;
  declare day: number;
  declare position: number;
  declare playlistId: number;
}

PlaylistSchedule.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    day: { type: DataTypes.SMALLINT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    playlistId: { type: DataTypes.INTEGER, allowNull: false, field: "playlist_id" },
  },
  { sequelize, tableName: "playlist_schedule", timestamps: false }
);

export default PlaylistSchedule;
