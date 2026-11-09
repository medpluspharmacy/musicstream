import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

/** The single branding row (id 1). Image fields hold refs; see lib/branding.ts. */
class Branding extends Model {
  declare id: number;
  declare companyName: string;
  declare logo: string | null;
  declare signInImages: string[];
  declare sidebarImage: string | null;
  declare bannerImage: string | null;
  declare updatedAt: Date;
}

Branding.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    companyName: { type: DataTypes.STRING(80), allowNull: false, field: "company_name" },
    logo: { type: DataTypes.TEXT },
    signInImages: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [], field: "sign_in_images" },
    sidebarImage: { type: DataTypes.TEXT, field: "sidebar_image" },
    bannerImage: { type: DataTypes.TEXT, field: "banner_image" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "branding", timestamps: false }
);

export default Branding;
