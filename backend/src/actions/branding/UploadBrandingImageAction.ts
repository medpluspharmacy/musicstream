import { Response } from "express";
import multer from "multer";
import { AuthRequest } from "../../middlewares/auth.js";
import BrandingController from "../../controllers/BrandingController.js";
import { sendError } from "../../lib/http-error.js";
import { UPLOAD_TMP_DIR } from "../../lib/storage.js";
import { MAX_IMAGE_BYTES } from "../../lib/branding.js";

const upload = multer({ dest: UPLOAD_TMP_DIR, limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single("file");

export class UploadBrandingImageAction {
  static handle(req: AuthRequest, res: Response) {
    // Run multer here rather than as route middleware so its errors become JSON responses.
    upload(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        const tooLarge = uploadErr instanceof multer.MulterError && uploadErr.code === "LIMIT_FILE_SIZE";
        res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "Images can be up to 5 MB" : "Upload failed" });
        return;
      }
      if (!req.file) { res.status(400).json({ error: "Choose an image to upload" }); return; }
      try {
        res.status(201).json(await BrandingController.upload(req.file));
      } catch (err) {
        sendError(res, err, "POST /admin/branding/images");
      }
    });
  }
}
