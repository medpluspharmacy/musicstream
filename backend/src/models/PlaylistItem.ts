import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";
import type MediaFile from "./MediaFile.js";

class PlaylistItem extends Model {
  declare id: number;
  declare mediaId: number;
  declare position: number;
  declare createdAt: Date;
  declare media?: MediaFile;
}

PlaylistItem.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    mediaId: { type: DataTypes.INTEGER, allowNull: false, field: "media_id" },
    position: { type: DataTypes.INTEGER, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "playlist_items", timestamps: false }
);

export default PlaylistItem;
