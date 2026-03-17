/**
 * @file core/backup.ts
 * @description .valor 형식의 암호화된 백업 파일을 생성하고 복원합니다.
 */

import fs from 'fs';
import path from 'path';
// @ts-ignore
const sodium = require('sodium-native');
import { logger } from '../utils/logger';

export const exportBackup = (data: any, filePath: string, encryptionKey: string) => {
  try {
    const message = Buffer.from(JSON.stringify(data));
    const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
    sodium.randombytes_buf(nonce);

    const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
    const password = Buffer.from(encryptionKey);
    sodium.crypto_generichash(key, password);

    const ciphertext = Buffer.alloc(message.length + sodium.crypto_secretbox_MACBYTES);
    sodium.crypto_secretbox_easy(ciphertext, message, nonce, key);

    // .valor 파일 구조: [NONCE(24)] + [CIPHERTEXT(msg+16)]
    const finalBuffer = Buffer.concat([nonce, ciphertext]);
    fs.writeFileSync(filePath, finalBuffer);

    logger.info(`Backup exported successfully to ${filePath}`);
    return true;
  } catch (error: any) {
    logger.error('Failed to export backup', { error: error.message });
    throw error;
  }
};

export const importBackup = (filePath: string, encryptionKey: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const nonce = buffer.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = buffer.subarray(sodium.crypto_secretbox_NONCEBYTES);

    const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
    const password = Buffer.from(encryptionKey);
    sodium.crypto_generichash(key, password);

    const message = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);
    const success = sodium.crypto_secretbox_open_easy(message, ciphertext, nonce, key);

    if (!success) {
      throw new Error('Decryption failed. Incorrect key or corrupted file.');
    }

    logger.info('Backup imported successfully.');
    return JSON.parse(message.toString());
  } catch (error: any) {
    logger.error('Failed to import backup', { error: error.message });
    throw error;
  }
};
