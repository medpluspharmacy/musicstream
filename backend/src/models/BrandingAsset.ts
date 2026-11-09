import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

/** An uploaded logo or background image. Ids are random UUIDs; the images are public. */
class BrandingAsset extends Model {
  declare id: string;
  declare storageKey: string;
  declare storageBackendId: number | null;
  declare mimeType: string;
  declare sizeBytes: number;
  declare createdAt: Date;
}

BrandingAsset.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    storageKey: { type: DataTypes.TEXT, allowNull: false, field: "storage_key" },
    storageBackendId: { type: DataTypes.INTEGER, field: "storage_backend_id" },
    mimeType: { type: DataTypes.STRING(32), allowNull: false, field: "mime_type" },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false, field: "size_bytes" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "branding_assets", timestamps: false }
);

export default BrandingAsset;
