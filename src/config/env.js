import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const defaultEnvFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const envFiles = [process.env.ENV_FILE, defaultEnvFile, '.env.local', '.env'].filter(Boolean);

for (const envFile of envFiles) {
    const resolvedPath = path.resolve(process.cwd(), envFile);

    if (fs.existsSync(resolvedPath)) {
        dotenv.config({path: resolvedPath});
    }
}

