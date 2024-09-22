import { Client as SshClient } from "ssh2";
import { colorLog } from "./utils.js";
import fs, {readFileSync} from "node:fs";
import path from "node:path";
import * as vars from "./variables.js";

export let isConnectionClosed = false;

export function connectSSH() {
    const config = {
        host: vars.SERVER_HOST,
        port: parseInt(process.env.SFTP_PORT) || 22,
        username: vars.SERVER_USER,
        privateKey: readFileSync(vars.SERVER_KEY, 'utf8'),
        readyTimeout: 20000,
    };
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

export function execCommand(client, command) {
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

export function uploadDirectorySFTP(client, localPath, remotePath) {
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
                    colorLog('CYAN', `🌎 Uploading ${currentLocalPath}`);
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

export function closeSSHConnection(client) {
    if (client && !isConnectionClosed) {
        isConnectionClosed = true;
        client.end();
    }
}
