import Database from 'better-sqlite3';
import { resolve } from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// @ts-ignore
const sodium = require('sodium-native');

export class EncryptedStore {
  private db: Database.Database;
  private key: Buffer;

  constructor(dbPath: string, encryptionKey: string) {
    const dir = resolve(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    this.db = new Database(resolve(dir, dbPath));
    this.key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
    
    // Hash the password to get a valid key length
    const password = Buffer.from(encryptionKey);
    sodium.crypto_generichash(this.key, password);

    this.initialize();
  }

  private initialize() {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS encrypted_data (
        id TEXT PRIMARY KEY,
        nonce BLOB,
        ciphertext BLOB
      )
    `).run();
  }

  set(id: string, data: any) {
    const message = Buffer.from(JSON.stringify(data));
    const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
    sodium.randombytes_buf(nonce);

    const ciphertext = Buffer.alloc(message.length + sodium.crypto_secretbox_MACBYTES);
    sodium.crypto_secretbox_easy(ciphertext, message, nonce, this.key);

    this.db.prepare(
      'INSERT OR REPLACE INTO encrypted_data (id, nonce, ciphertext) VALUES (?, ?, ?)'
    ).run(id, nonce, ciphertext);
  }

  get(id: string): any {
    const row: any = this.db.prepare(
      'SELECT nonce, ciphertext FROM encrypted_data WHERE id = ?'
    ).get(id);

    if (!row) return null;

    const message = Buffer.alloc(row.ciphertext.length - sodium.crypto_secretbox_MACBYTES);
    const success = sodium.crypto_secretbox_open_easy(message, row.ciphertext, row.nonce, this.key);

    if (!success) {
      logger.error('Failed to decrypt data', { id });
      return null;
    }

    return JSON.parse(message.toString());
  }
}
