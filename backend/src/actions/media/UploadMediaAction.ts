import { Response } from "express";
import multer from "multer";
import { AuthRequest } from "../../middlewares/auth.js";
import MediaController from "../../controllers/MediaController.js";
import { sendError } from "../../lib/http-error.js";
import { UPLOAD_TMP_DIR } from "../../lib/storage.js";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 500;

const upload = multer({
  dest: UPLOAD_TMP_DIR,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
}).single("file");

export class UploadMediaAction {
  static handle(req: AuthRequest, res: Response) {
    // Run multer here rather than as route middleware so its errors become JSON responses.
    upload(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        const tooLarge = uploadErr instanceof multer.MulterError && uploadErr.code === "LIMIT_FILE_SIZE";
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge ? `File is larger than ${MAX_UPLOAD_MB} MB` : "Upload failed",
        });
        return;
      }
      if (!req.file) { res.status(400).json({ error: "Choose a file to upload" }); return; }
      try {
        const media = await MediaController.create(req.file, req.body?.title, req.body?.durationSeconds, req.user!.id);
        res.status(201).json(media);
      } catch (err) {
        sendError(res, err, "POST /admin/media");
      }
    });
  }
}
