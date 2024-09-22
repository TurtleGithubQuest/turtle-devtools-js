import { colorLog } from "./utils.js";
import { existsSync } from "node:fs";

export const SERVER_HOST = process.env.SERVER_HOST;
export const SERVER_USER = process.env.SERVER_USER;
export const SERVER_PASSWORD = process.env.SERVER_PASSWORD;
export const SERVER_KEY = process.env.SERVER_KEY;
export const SERVER_PATH = process.env.SERVER_PATH || "/";
export const LOCAL_PATH = process.env.LOCAL_PATH || "./website";
export const JS_PATH = process.env.JS_PATH || "./src";

let missingVariables = [];

if (!SERVER_USER) {
    missingVariables.push("SERVER_USER");
}

if (!SERVER_HOST) {
    missingVariables.push("SERVER_HOST");
}

if (!SERVER_PATH) {
    missingVariables.push("SERVER_PATH");
}

// Check for at least one authentication method
if (!SERVER_PASSWORD && !SERVER_KEY) {
    missingVariables.push("SERVER_PASSWORD or SERVER_KEY");
}

if (SERVER_KEY && !existsSync(SERVER_KEY)) {
    colorLog('RED', 'Key path specified, but the key was not found!');
    missingVariables.push("SERVER_KEY");
}

if (missingVariables.length > 0) {
    colorLog("RED", `Missing required environment variables: ${missingVariables.join(", ")}. Please set the necessary variables.`);
    process.exit(1);
}