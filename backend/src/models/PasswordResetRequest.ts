import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";
import type User from "./User.js";

export type ResetStatus = "pending" | "approved" | "declined" | "replaced";

class PasswordResetRequest extends Model {
  declare id: number;
  declare userId: number;
  declare passwordHash: string;
  declare verifiedWith2fa: boolean;
  declare status: ResetStatus;
  declare createdAt: Date;
  declare decidedAt: Date | null;
  declare decidedById: number | null;
  declare user?: User;
}

PasswordResetRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    passwordHash: { type: DataTypes.TEXT, allowNull: false, field: "password_hash" },
    verifiedWith2fa: { type: DataTypes.BOOLEAN, allowNull: false, field: "verified_with_2fa" },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "pending" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    decidedAt: { type: DataTypes.DATE, field: "decided_at" },
    decidedById: { type: DataTypes.INTEGER, field: "decided_by_id" },
  },
  { sequelize, tableName: "password_reset_requests", timestamps: false }
);

export default PasswordResetRequest;
