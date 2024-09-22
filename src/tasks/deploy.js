import { build } from "./build.js";
import { colorLog } from "../utils/utils.js";
import * as vars from "../utils/variables.js";
import fs from "node:fs";
import path from "node:path";

import { Client as FtpClient } from "basic-ftp";
import { Client as SshClient } from "ssh2";

// State variable to prevent multiple SSH connection closures
let isConnectionClosed = false;

// Helper function to establish SSH connection
function connectSSH(config) {
    return new Promise((resolve, reject) => {
        const client = new SshClient();

        client.on('ready', () => {
            colorLog("GREEN", "SSH connection established.");
            resolve(client);
        });

        client.on('error', (err) => {
            colorLog("RED", `SSH Connection Error: ${err.message}`);
            reject(err);
        });

        client.on('end', () => {
            if (!isConnectionClosed) {
                isConnectionClosed = true;
                colorLog("YELLOW", "SSH connection ended.");
            }
        });

        client.on('close', (hadError) => {
            if (!isConnectionClosed) {
                isConnectionClosed = true;
                colorLog("YELLOW", `SSH connection closed${hadError ? " due to an error." : "."}`);
            }
        });

        client.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
            // Handle keyboard-interactive authentication if required
            colorLog("YELLOW", "Keyboard-interactive authentication requested.");
            // For example purposes, rejecting the authentication
            finish([]);
        });

        try {
            client.connect(config);
        } catch (err) {
            colorLog("RED", `Failed to initiate SSH connection: ${err.message}`);
            reject(err);
        }
    });
}

// Helper function to execute a command over SSH
function execCommand(client, command) {
    return new Promise((resolve, reject) => {
        client.exec(command, (err, stream) => {
            if (err) {
                colorLog("RED", `Error executing command: ${err.message}`);
                return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(stderr.trim() || `Command exited with code ${code}`));
                }
            }).on('data', (data) => {
                stdout += data.toString();
            }).stderr.on('data', (data) => {
                stderr += data.toString();
            });
        });
    });
}

// Helper function to upload directory via SFTP
function uploadDirectorySFTP(client, localPath, remotePath) {
    return new Promise((resolve, reject) => {
        client.sftp(async (err, sftp) => {
            if (err) {
                colorLog("RED", `SFTP Error: ${err.message}`);
                return reject(err);
            }

            const walk = async (currentLocalPath, currentRemotePath) => {
                const stats = fs.lstatSync(currentLocalPath);
                if (stats.isDirectory()) {
                    try {
                        const files = fs.readdirSync(currentLocalPath);
                        await mkdirSFTP(sftp, currentRemotePath);
                        for (const file of files) {
                            await walk(path.join(currentLocalPath, file), path.posix.join(currentRemotePath, file));
                        }
                    } catch (err) {
                        throw err;
                    }
                } else if (stats.isFile()) {
                    colorLog('CYAN', `Uploading ${currentLocalPath}`);
                    await uploadFileSFTP(sftp, currentLocalPath, currentRemotePath);
                } else {
                    throw Error(`Path is not valid: ${currentLocalPath}`)
                }
            };

            const mkdirSFTP = (sftp, remotePath) => {
                return new Promise((resolve, reject) => {
                    sftp.mkdir(remotePath, { mode: 0o755 }, (err) => {
                        if (err) {
                            if (parseInt(err.code) === 4) {
                                colorLog("YELLOW", `Directory already exists: '${remotePath}'`);
                                resolve();
                            } else {
                                colorLog("RED", `Failed to create directory '${remotePath}': ${err.message}`);
                                reject(err);
                            }
                        } else {
                            colorLog("GREEN", `Directory created: '${remotePath}'`);
                            resolve();
                        }
                    });
                });
            };

            const uploadFileSFTP = (sftp, local, remote) => {
                return new Promise((resolve, reject) => {
                    sftp.fastPut(local, remote, {}, (err) => {
                        if (err) {
                            colorLog("RED", `Failed to upload ${local} to ${remote}: ${err.message}`);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            };

            try {
                await walk(localPath, remotePath);
                colorLog("GREEN", "SFTP upload completed successfully.");
                sftp.end(); // Only end SFTP session
                resolve();
            } catch (error) {
                colorLog("RED", `SFTP Upload Error: ${error.message}`);
                sftp.end(); // Only end SFTP session
                reject(error);
            }
        });
    });
}

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
