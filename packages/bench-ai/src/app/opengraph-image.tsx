import { ImageResponse } from "next/og";
import { BRAND_NAME, BRAND_TAGLINE } from "../lib/brand";

export const alt = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview card; copy matches `../lib/brand.ts` (not static PNG). */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#f9f9f9",
          backgroundImage:
            "linear-gradient(135deg, #f9f9f9 0%, #ffffff 45%, #eff6ff 100%)",
          padding: 72,
        }}
      >
        <div
          style={{
            width: 120,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#2563eb",
            marginBottom: 36,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: "#0a0a0a",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              fontFamily:
                'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
          >
            {BRAND_NAME}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              color: "#525252",
              maxWidth: 920,
              lineHeight: 1.35,
              fontFamily:
                'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
          >
            {BRAND_TAGLINE}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
