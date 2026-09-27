const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const command = process.platform === "win32" ? "fiori.cmd" : "fiori";
const projectRoot = path.resolve(__dirname, "..");
const runtimeConfig = path.join(projectRoot, ".ui5-runtime.yaml");
const username = process.env.SAP_USERNAME || process.env.FIORI_TOOLS_USER || process.env.USERNAME;
const password = process.env.SAP_PASSWORD || process.env.FIORI_TOOLS_PASSWORD || process.env.PASSWORD;
const backendUrl = process.env.SAP_BACKEND_URL || "https://my433482-api.s4hana.cloud.sap";

if (!username || !password) {
    throw new Error("Missing SAP_USERNAME or SAP_PASSWORD in .env");
}

const config = fs.readFileSync(path.join(projectRoot, "ui5.yaml"), "utf8");
const authenticatedUrl = backendUrl.replace("://", "://" + encodeURIComponent(username) + ":" + encodeURIComponent(password) + "@");
fs.writeFileSync(runtimeConfig, config.replace("https://my433482-api.s4hana.cloud.sap", authenticatedUrl), "utf8");

const child = spawn(command, ["run", "--config", ".ui5-runtime.yaml", "--open", "test/flp.html#app-preview"], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32"
});

child.on("exit", function (code, signal) {
    fs.rmSync(runtimeConfig, { force: true });
    process.exitCode = code || (signal ? 1 : 0);
});