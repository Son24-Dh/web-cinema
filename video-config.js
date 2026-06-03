window.CINESCOPE_HLS_SOURCE = "";
const hostname = window.location.hostname;
const isLocal = ["localhost", "127.0.0.1", "::1", ""].includes(hostname)
    || window.location.port !== ""
    || window.location.protocol === "file:"
    || /^192\.168\./.test(hostname)
    || /^10\./.test(hostname)
    || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    || hostname.endsWith(".local");
window.DAU_PHIM_DATA_URL = isLocal ? "data.json" : "https://raw.githubusercontent.com/Son24-Dh/web-cinema/main/data.json";
