import QRCode from "qrcode";

/** 友だち追加URLのQR（SVG文字列） */
export async function qrSvg(url: string, size = 240): Promise<string> {
  return QRCode.toString(url, { type: "svg", width: size, margin: 1, errorCorrectionLevel: "M" });
}
