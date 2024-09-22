import { build } from "./build.js";
import { colorLog } from "../utils/utils.js";
import * as vars from "../utils/variables.js";
import { connectSSH, execCommand, uploadDirectorySFTP, closeSSHConnection } from "../utils/ssh-utils.js";
import path from "node:path";

import { Client as FtpClient } from "basic-ftp";

// State variable to prevent multiple SSH connection closures

export async function deploy() {
    let sshClient;
    try {
        colorLog("YELLOW", "Starting deployment...");

        if (vars.SERVER_PASSWORD) {
            // FTP Deployment
            colorLog("YELLOW", "Connecting via FTP...");
            const ftpClient = new FtpClient();
            ftpClient.ftp.verbose = true;
            await ftpClient.access({
                host: vars.SERVER_HOST,
                user: vars.SERVER_USER,
                password: vars.SERVER_PASSWORD,
                secure: true, // Enable FTPS
            });

            colorLog("GREEN", "FTP connection established.");

            // Upload directory using FTP
            colorLog("YELLOW", "Uploading files via FTP...");
            await ftpClient.uploadFromDir(vars.LOCAL_PATH, vars.SERVER_PATH);
            colorLog("GREEN", "FTP upload completed successfully.");
            ftpClient.close();
            colorLog("YELLOW", "FTP connection closed.");
        } else if (vars.SERVER_KEY) {
            // SSH Deployment
            colorLog("YELLOW", "Establishing SSH connection...");

            const config = {
                host: vars.SERVER_HOST,
                port: parseInt(process.env.SFTP_PORT) || 22,
                username: vars.SERVER_USER,
                privateKey: fs.readFileSync(vars.SERVER_KEY, 'utf8'),
                readyTimeout: 20000, // 20 seconds timeout
            };

            try {
                sshClient = await connectSSH(config);
            } catch (err) {
                colorLog("RED", `Failed to establish SSH connection: ${err.message}`);
                process.exit(1);
            }

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
                    const stats = fs.lstatSync(absoluteLocalPath);
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
                closeSSHConnection(sshClient);
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
