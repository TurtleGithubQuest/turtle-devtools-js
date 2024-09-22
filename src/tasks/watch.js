import { watch } from "fs";
import { uploadFileSSH } from "../utils/ssh-utils.js";
import * as vars from "../utils/variables.js";
import path from "path";
import {colorLog} from "../utils/utils.js";
import {buildJavaScript} from "./build.js";

import * as vars from "../utils/variables.js";

// Debounce function to limit the rate at which uploads are triggered
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Function to upload a file to the server
async function uploadFile(localPath, remotePath) {
    const client = new Client();
    let attempts = 0;
    const maxAttempts = 5;
    let success = false;

    while (attempts < maxAttempts && !success) {
        try {
            await client.access({
                host: vars.SERVER_HOST,
                user: vars.SERVER_USER,
                password: vars.SERVER_PASSWORD || undefined,
                secure: true, // Enable FTPS
                privateKey: vars.SERVER_PASSWORD ? undefined : vars.SERVER_KEY,
            });
            colorLog("GREEN", `Uploading file: ${localPath} (Attempt ${attempts + 1})`);
            await client.uploadFrom(localPath, remotePath);
            success = true;
        } catch (error) {
            attempts++;
            colorLog("RED", `Error uploading file ${localPath} (Attempt ${attempts}): ${error}`);
            if (attempts >= maxAttempts) {
                colorLog("RED", `Failed to upload file ${localPath} after ${maxAttempts} attempts.`);
            }
        } finally {
            client.close();
        }
    }
}

// Debounced upload function
const debouncedUploadFile = debounce(async (filename) => {
    const localFilePath = path.join(vars.LOCAL_PATH, filename);
    const remoteFilePath = path.join(vars.SERVER_PATH, filename);

    await uploadFile(localFilePath, remoteFilePath);
}, 15); // Adjust debounce delay as needed

// Watch for changes in the directory
colorLog("BRIGHT_MAGENTA", `Watching for changes in folder '${vars.LOCAL_PATH.replace("./", "")}'...`);
watch(vars.LOCAL_PATH, { recursive: true }, async (eventType, filename) => {
    // Only trigger upload on file changes (not on rename or delete)
    if (eventType !== 'change' && filename) {
        colorLog("BRIGHT_WHITE", `${eventType}d ${filename}.`);
    }
    // Ignore temporary files
    if (!filename.endsWith('~')) {
        await debouncedUploadFileSSH(filename);
    }
});
colorLog("BRIGHT_MAGENTA", `Watching for changes in folder '${vars.JS_PATH.replace("./", "")}'...`);
watch(vars.JS_PATH, { recursive: true }, async (eventType, filename) => {
    if (eventType === 'change')
        debounce(buildJavaScript(true), 15);
});
