import sequelize from "../db/sequelize.js";
import User from "./User.js";
import MediaFile from "./MediaFile.js";
import PlaylistItem from "./PlaylistItem.js";
import StationState from "./StationState.js";
import StorageBackend from "./StorageBackend.js";
import Branding from "./Branding.js";
import BrandingAsset from "./BrandingAsset.js";
import PasswordResetRequest from "./PasswordResetRequest.js";
import Playlist from "./Playlist.js";
import PlaylistSchedule from "./PlaylistSchedule.js";

PlaylistItem.belongsTo(MediaFile, { foreignKey: "mediaId", as: "media" });
MediaFile.hasMany(PlaylistItem, { foreignKey: "mediaId", as: "playlistItems" });
PasswordResetRequest.belongsTo(User, { foreignKey: "userId", as: "user" });
PasswordResetRequest.belongsTo(User, { foreignKey: "decidedById", as: "decidedBy" });

export {
  sequelize,
  User,
  MediaFile,
  PlaylistItem,
  StationState,
  StorageBackend,
  Branding,
  BrandingAsset,
  PasswordResetRequest,
  Playlist,
  PlaylistSchedule,
};
