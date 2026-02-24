import { Font } from "@react-pdf/renderer";

export function registerPdfFonts() {
  Font.register({
    family: "NotoSansJP",
    fonts: [
      {
        src: "https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj757WNiVAx2dqKw.otf",
        fontWeight: 400,
      },
      {
        src: "https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFqyTUD6sSo8joaQ6LmSQ.otf",
        fontWeight: 700,
      },
    ],
  });
}
