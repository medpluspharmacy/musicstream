import sequelize from "../db/sequelize.js";
import User from "./User.js";
import MediaFile from "./MediaFile.js";
import PlaylistItem from "./PlaylistItem.js";
import StationState from "./StationState.js";
import StorageBackend from "./StorageBackend.js";

PlaylistItem.belongsTo(MediaFile, { foreignKey: "mediaId", as: "media" });
MediaFile.hasMany(PlaylistItem, { foreignKey: "mediaId", as: "playlistItems" });

export {
  sequelize,
  User,
  MediaFile,
  PlaylistItem,
  StationState,
  StorageBackend,
};
