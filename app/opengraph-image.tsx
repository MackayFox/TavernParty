import { ImageResponse } from "next/og";

export const alt = "Tavern Party: a free fantasy roleplaying game in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card. No external fonts and no images, so a cold deploy cannot fail
 * to render one: system serif, flat colour, and everything else is a box.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#120E0A",
          padding: 72,
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 18,
              height: 34,
              background: "#E9DDC1",
              borderRadius: 3,
            }}
          />
          <div
            style={{
              color: "#BCAE9A",
              fontSize: 26,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            tavernparty.com
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#F5EFE4",
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 1.05,
              textTransform: "uppercase",
            }}
          >
            Roll a character
          </div>
          <div
            style={{
              color: "#E8B54A",
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 1.05,
              textTransform: "uppercase",
            }}
          >
            Survive the night
          </div>
          <div style={{ color: "#BCAE9A", fontSize: 34, marginTop: 26, maxWidth: 900 }}>
            Five encounters, one party, and exactly one of you walks out with the loot.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["2-6 PLAYERS", "10 MINUTES", "NO DOWNLOAD", "4 DAILY PUZZLES"].map((chip) => (
            <div
              key={chip}
              style={{
                border: "2px solid #4A3E33",
                borderRadius: 8,
                padding: "10px 20px",
                color: "#BCAE9A",
                fontSize: 24,
                letterSpacing: 2,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
