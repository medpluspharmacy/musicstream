import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StorageBackend extends Model {
  declare id: number;
  declare driver: "local" | "s3";
  declare provider: string;
  declare location: string;
  declare endpoint: string;
  declare bucket: string;
  declare prefix: string;
  declare accessKeyId: string | null;
  declare secretAccessKey: string | null;
  declare forcePathStyle: boolean;
  declare isActive: boolean;
  declare updatedAt: Date;
}

StorageBackend.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    driver: { type: DataTypes.STRING(16), allowNull: false },
    provider: { type: DataTypes.STRING(32), allowNull: false },
    location: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "" },
    endpoint: { type: DataTypes.STRING(500), allowNull: false, defaultValue: "" },
    bucket: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "" },
    prefix: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    accessKeyId: { type: DataTypes.TEXT, field: "access_key_id" },
    secretAccessKey: { type: DataTypes.TEXT, field: "secret_access_key" },
    forcePathStyle: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "force_path_style" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_active" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "storage_backends", timestamps: false }
);

export default StorageBackend;
