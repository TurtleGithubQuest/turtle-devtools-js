import { Client as SshClient } from "ssh2";
import { colorLog } from "./utils.js";
import fs from "node:fs";
import path from "node:path";

// State variable to prevent multiple SSH connection closures
let isConnectionClosed = false;

export function connectSSH(config) {
    // ... (same as in deploy.js)
}

export function execCommand(client, command) {
    // ... (same as in deploy.js)
}

export function uploadDirectorySFTP(client, localPath, remotePath) {
    // ... (same as in deploy.js)
}

export function closeSSHConnection(client) {
    if (client && !isConnectionClosed) {
        isConnectionClosed = true;
        client.end();
    }
}
import { Client as SshClient } from "ssh2";
import { colorLog } from "./utils.js";
import fs from "node:fs";
import path from "node:path";

// State variable to prevent multiple SSH connection closures
let isConnectionClosed = false;

export function connectSSH(config) {
    const client = new SshClient();
    client.on('ready', () => {
        colorLog("GREEN", "SSH connection established.");
        isConnectionClosed = false;
    }).on('error', (err) => {
        colorLog("RED", `SSH Connection Error: ${err.message}`);
        isConnectionClosed = true;
    }).on('end', () => {
        colorLog("YELLOW", "SSH connection ended.");
        isConnectionClosed = true;
    }).on('close', (hadError) => {
        colorLog("YELLOW", `SSH connection closed${hadError ? " due to an error." : "."}`);
        isConnectionClosed = true;
    });
    client.connect(config);
    return client;
}

export function execCommand(client, command) {
    // ... (same as in deploy.js)
}

export function uploadDirectorySFTP(client, localPath, remotePath) {
    // ... (same as in deploy.js)
}

export function closeSSHConnection(client) {
    if (client && !isConnectionClosed) {
        isConnectionClosed = true;
        client.end();
    }
}
