import { existsSync, watch } from 'fs';
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
  const remotePath = path.join(env.SERVER_PATH, filename);
  const client = new FTPClient();

  try {
    await client.access({
      host: env.SERVER_HOST,
      user: env.SERVER_USER,
      password: env.SERVER_PASSWORD,
      secure: true,
    });
    await client.uploadFrom(localPath, remotePath);
    colorLog('CYAN', `🌎 Uploaded ${localPath}`);
  } catch (error) {
    colorLog('RED', `Error uploading file ${localPath} via FTP: ${error.message}`);
  } finally {
    await client.close();
  }
}, 500);

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