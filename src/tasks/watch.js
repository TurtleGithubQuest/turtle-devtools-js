import {existsSync, watch} from "fs";
import {connectSSH, uploadDirectorySFTP} from "../utils/ssh-utils.js";
import path, {resolve} from "path";
import { colorLog } from "../utils/utils.js";
import { buildJavaScript } from "./build.js";
import * as vars from "../utils/variables.js";

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
const sshClient = await connectSSH();

const debouncedUploadFileSSH = debounce(async (filename) => {
    const localFilePath = path.join(vars.LOCAL_PATH, filename);
    const remoteFilePath = path.join(vars.SERVER_PATH, filename);

    try {
        await uploadDirectorySFTP(sshClient, localFilePath, remoteFilePath);
    } catch (error) {
        colorLog("RED", `Error uploading file ${filename}: ${error.message}`);
    }
}, 500);

const debouncedBuildJavaScript = debounce(() => buildJavaScript(true), 500);

if (existsSync(vars.LOCAL_PATH)) {
    colorLog("BRIGHT_MAGENTA", `Watching for changes in folder '${vars.LOCAL_PATH.replace("./", "")}'...`);
    watch(vars.LOCAL_PATH, {recursive: true}, async (eventType, filename) => {
        if (filename && !filename.endsWith('~')) {
            await debouncedUploadFileSSH(filename);
        }
    });
} else {
    colorLog("RED", `Folder '${resolve(vars.LOCAL_PATH)}' not found.`);
}

if (existsSync(vars.JS_PATH)) {
    colorLog("BRIGHT_MAGENTA", `Watching for changes in folder '${vars.JS_PATH.replace("./", "")}'...`);
    watch(vars.JS_PATH, {recursive: true}, async (eventType, filename) => {
        if (eventType === 'change') {
            debouncedBuildJavaScript();
        }
    });
} else {
    colorLog("RED", `Folder '${resolve(vars.JS_PATH)}' not found.`);
}