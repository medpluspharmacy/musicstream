import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Playlist extends Model {
  declare id: number;
  declare name: string;
  declare createdAt: Date;
}

Playlist.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "playlists", timestamps: false }
);

export default Playlist;
