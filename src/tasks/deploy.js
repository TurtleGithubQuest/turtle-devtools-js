import { build } from "./build.js";
import { colorLog } from "../utils/utils.js";
import * as vars from "../utils/variables.js";
import { readFileSync, lstatSync } from 'node:fs';
import path from "node:path";

import { Client as FtpClient } from "basic-ftp";
import "../utils/ssh-utils";
import {connectSSH, execCommand, isConnectionClosed, uploadDirectorySFTP} from "../utils/ssh-utils.js";

export async function deploy() {
    let sshClient;
    try {
        colorLog("YELLOW", "Starting deployment...");

        if (vars.SERVER_PASSWORD) {
            // FTP Deployment
            colorLog("YELLOW", "Connecting via FTP...");
            const ftpClient = new FtpClient();
            await ftpClient.access({
                host: vars.SERVER_HOST,
                user: vars.SERVER_USER,
                password: vars.SERVER_PASSWORD,
                secure: true,
            });

            colorLog("GREEN", "FTP connection established.");
            colorLog("YELLOW", "Uploading files via FTP...");
            await ftpClient.uploadFromDir(vars.LOCAL_PATH, vars.SERVER_PATH);
            colorLog("GREEN", "FTP upload completed successfully.");
            ftpClient.close();
            colorLog("YELLOW", "FTP connection closed.");
        } else if (vars.SERVER_KEY) {
            colorLog("YELLOW", "Establishing SSH connection...");
            sshClient = await connectSSH();

            try {
                // Check if remote directory exists
                const checkDirCommand = `test -d "${vars.SERVER_PATH}" && echo "Directory exists" || echo "Directory does not exist"`;
                const dirStatus = await execCommand(sshClient, checkDirCommand);

                if (dirStatus !== "Directory exists") {
                    colorLog("YELLOW", `Creating remote directory: ${vars.SERVER_PATH}`);
                    await execCommand(sshClient, `mkdir -p "${vars.SERVER_PATH}"`);
                    colorLog("GREEN", "Remote directory created.");
                }

                const absoluteLocalPath = path.resolve(vars.LOCAL_PATH);

                try {
                    const stats = lstatSync(absoluteLocalPath);
                    if (!stats.isDirectory()) {
                        colorLog('RED', `Path is not a directory: '${absoluteLocalPath}'`);
                        sshClient.end();
                        process.exit(1);
                    }
                } catch (err) {
                    colorLog('RED', `Error accessing path '${absoluteLocalPath}': ${err.message}`);
                    sshClient.end();
                    process.exit(1);
                }

                await uploadDirectorySFTP(sshClient, absoluteLocalPath, vars.SERVER_PATH);
            } catch (err) {
                colorLog('RED', `Deployment Error: ${err.message}`);
            } finally {
                if (sshClient && !isConnectionClosed) {
                    sshClient.end();
                }
            }
        } else {
            colorLog("RED", "Error: No password or key provided.");
            process.exit(1);
        }
    } catch (error) {
        colorLog("RED", `Deployment failed: ${error.message}`);
    }
}

if (import.meta.main) {
    await build();
    colorLog("BRIGHT_MAGENTA", "Deploying...");
    await deploy();
}
