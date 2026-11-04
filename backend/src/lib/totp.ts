import speakeasy from "speakeasy";
import QRCode from "qrcode";

const ISSUER = "MusicStream";

export function generateSecret(label: string) {
  const secret = speakeasy.generateSecret({
    name: `${ISSUER} (${label})`,
    issuer: ISSUER,
    length: 20,
  });
  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url ?? "",
  };
}

export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: "M", width: 240, margin: 1 });
}

export function verifyToken(secretBase32: string, token: string): boolean {
  if (!secretBase32 || !token) return false;
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: "base32",
    token: token.trim(),
    window: 1,
  });
}
