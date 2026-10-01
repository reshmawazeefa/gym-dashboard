const LOCAL_API_ORIGIN = "http://localhost:3000";
const PRODUCTION_API_ORIGIN = "https://gym-api.wazeefa.in";

export function resolveGymLogoUrl(logo) {
  if (!logo || typeof logo !== "string") return "";
  if (logo.startsWith(LOCAL_API_ORIGIN)) {
    return `${PRODUCTION_API_ORIGIN}${logo.slice(LOCAL_API_ORIGIN.length)}`;
  }
  return logo;
}
