import { watch } from "fs";
import { debounce, uploadFileSSH } from "../utils/utils.js";
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

// Debounced upload function
const debouncedUploadFileSSH = debounce(async (filename) => {
    const localFilePath = path.join(vars.LOCAL_PATH, filename);
    const remoteFilePath = path.join(vars.SERVER_PATH, filename);

    await uploadFileSSH(localFilePath, remoteFilePath);
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
        await debouncedUploadFileSSH(filename);
    }
});
colorLog("BRIGHT_MAGENTA", `Watching for changes in folder '${vars.JS_PATH.replace("./", "")}'...`);
watch(vars.JS_PATH, { recursive: true }, async (eventType, filename) => {
    if (eventType === 'change')
        debounce(buildJavaScript(true), 15);
});
