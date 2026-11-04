import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class MediaFile extends Model {
  declare id: number;
  declare title: string;
  declare kind: "audio" | "video";
  declare provider: string;
  declare providerRef: string | null;
  declare mimeType: string;
  declare sizeBytes: number;
  declare durationSeconds: number;
  declare storageKey: string | null;
  declare originalName: string | null;
  declare uploadedById: number | null;
  declare createdAt: Date;
}

MediaFile.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    kind: { type: DataTypes.TEXT, allowNull: false },
    provider: { type: DataTypes.TEXT, allowNull: false, defaultValue: "upload" },
    providerRef: { type: DataTypes.TEXT, field: "provider_ref" },
    mimeType: { type: DataTypes.TEXT, allowNull: false, field: "mime_type" },
    // BIGINT comes back from pg as a string; expose it as a number.
    sizeBytes: {
      type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "size_bytes",
      get() { return Number(this.getDataValue("sizeBytes")); },
    },
    durationSeconds: { type: DataTypes.DOUBLE, allowNull: false, field: "duration_seconds" },
    storageKey: { type: DataTypes.TEXT, field: "storage_key" },
    originalName: { type: DataTypes.TEXT, field: "original_name" },
    uploadedById: { type: DataTypes.INTEGER, field: "uploaded_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "media_files", timestamps: false }
);

export default MediaFile;
