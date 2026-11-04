import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

export type ApprovalStatus = "pending" | "approved" | "declined";

class User extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare role: string;
  declare isActive: boolean;
  declare tokenVersion: number;
  declare totpSecret: string | null;
  declare totpEnabled: boolean;
  declare approvalStatus: ApprovalStatus;
  declare permissions: string[];
  declare createdAt: Date;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    email: { type: DataTypes.TEXT, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.TEXT, allowNull: false, field: "password_hash" },
    role: { type: DataTypes.TEXT, allowNull: false, defaultValue: "user" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
    tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "token_version" },
    totpSecret: { type: DataTypes.TEXT, field: "totp_secret" },
    totpEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "totp_enabled" },
    approvalStatus: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "pending", field: "approval_status" },
    permissions: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "users", timestamps: false }
);

export default User;
