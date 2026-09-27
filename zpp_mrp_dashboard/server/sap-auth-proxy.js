const path = require("path");
const dotenv = require("dotenv");
const { createProxyMiddleware } = require("http-proxy-middleware");

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const username = process.env.SAP_USERNAME || process.env.FIORI_TOOLS_USER || process.env.USERNAME;
const password = process.env.SAP_PASSWORD || process.env.FIORI_TOOLS_PASSWORD || process.env.PASSWORD;
const target = process.env.SAP_BACKEND_URL || "https://my433482-api.s4hana.cloud.sap";

module.exports = function () {
    if (!username || !password) {
        throw new Error("Missing SAP_USERNAME or SAP_PASSWORD in .env");
    }

    return createProxyMiddleware({
        target,
        changeOrigin: true,
        secure: true,
        pathFilter: "/sap",
        on: {
            proxyReq: function (proxyReq) {
                var credentials = Buffer.from(username + ":" + password).toString("base64");
                proxyReq.setHeader("Authorization", "Basic " + credentials);
            }
        }
    });
};