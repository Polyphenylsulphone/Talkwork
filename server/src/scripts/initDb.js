import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sqlPath = path.join(__dirname, '../../sql/schema.sql');
  const raw = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    multipleStatements: true,
  });
  const statements = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const st of statements) {
    await conn.query(st + ';');
  }
  await conn.end();
  console.log('Schema applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
