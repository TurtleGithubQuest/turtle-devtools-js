import { existsSync, watch, readdirSync, statSync } from 'fs';
import path, { resolve } from 'path';
import { Client as FTPClient } from "basic-ftp"
import { connectSSH, uploadDirectorySFTP } from '../utils/ssh-utils.js';
import { colorLog } from '../utils/utils.js';
import { buildJavaScript } from './build.js';
import * as env from '../utils/variables.js';

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const uploadFileFTP = debounce(async (filename) => {
  const localPath = path.join(env.LOCAL_PATH, filename);
  const remotePath = path.join(env.SERVER_PATH, filename).replace(/\\/g, '/');
  const client = new FTPClient();

  try {
    await client.access({
      host: env.SERVER_HOST,
      user: env.SERVER_USER,
      password: env.SERVER_PASSWORD,
      secure: true,
    });

    const stats = statSync(localPath);

    if (stats.isFile()) {
      await client.uploadFrom(localPath, remotePath);
      colorLog('CYAN', `🌎 Uploaded ${localPath}`);
    } else if (stats.isDirectory()) {
      await uploadDirectory(client, localPath, remotePath);
      colorLog('CYAN', `📁 Uploaded ${localPath}`);
    } else {
      colorLog('YELLOW', `⚠️ Skipped: ${localPath} (Not a file or directory)`);
    }
  } catch (error) {
    colorLog('RED', `Error uploading ${localPath} via FTP: ${error.message}`);
  } finally {
    client.close();
  }
}, 500);

/**
 * Recursively uploads a directory to the FTP server.
 * @param {FTPClient} client - The FTP client instance.
 * @param {string} localDir - The local directory path.
 * @param {string} remoteDir - The remote directory path.
 */
async function uploadDirectory(client, localDir, remoteDir) {
  await client.ensureDir(remoteDir);
  await client.cd(remoteDir);

  const items = readdirSync(localDir);

  for (const item of items) {
    const localPath = path.join(localDir, item);
    const remotePath = path.posix.join(remoteDir, item);

    const stats = statSync(localPath);

    if (stats.isFile()) {
      await client.uploadFrom(localPath, item);
      colorLog('CYAN', `🌎 Uploaded ${localPath}`);
    } else if (stats.isDirectory()) {
      await uploadDirectory(client, localPath, remotePath);
      colorLog('CYAN', `📁 Uploaded ${localPath}`);
    }
  }
  await client.cd('..');
}

const uploadFileSSH = debounce(async (filename) => {
  const localFilePath = path.join(env.LOCAL_PATH, filename);
  const remoteFilePath = path.join(env.SERVER_PATH, filename);

  try {
    const sshClient = await connectSSH();
    await uploadDirectorySFTP(sshClient, localFilePath, remoteFilePath);
    sshClient.dispose();
    colorLog('CYAN', `🌎 Uploaded ${localFilePath}`);
  } catch (error) {
    colorLog('RED', `Error uploading file ${filename} via SSH: ${error.message}`);
  }
}, 500);

const debouncedBuildJavaScript = debounce(() => buildJavaScript(true), 500);

(async () => {
  if (existsSync(env.LOCAL_PATH)) {
    colorLog(
      'BRIGHT_MAGENTA',
      `Watching for changes in folder '${env.LOCAL_PATH.replace('./', '')}'...`
    );

    if (env.SERVER_PASSWORD) {
      // Watch and upload via FTP
      watch(env.LOCAL_PATH, { recursive: true }, async (eventType, filename) => {
        if (filename && !filename.endsWith('~')) {
          await uploadFileFTP(filename);
        }
      });
    } else {
      // Watch and upload via SSH
      watch(env.LOCAL_PATH, { recursive: true }, async (eventType, filename) => {
        if (filename && !filename.endsWith('~')) {
          await uploadFileSSH(filename);
        }
      });
    }
  } else {
    colorLog('RED', `Folder '${resolve(env.LOCAL_PATH)}' not found.`);
  }

  if (existsSync(env.JS_PATH)) {
    colorLog(
      'BRIGHT_MAGENTA',
      `Watching for changes in folder '${env.JS_PATH.replace('./', '')}'...`
    );
    watch(env.JS_PATH, { recursive: true }, (eventType) => {
      if (eventType === 'change') {
        debouncedBuildJavaScript();
      }
    });
  } else {
    colorLog('RED', `Folder '${resolve(env.JS_PATH)}' not found.`);
  }
})();