import fs from 'node:fs';
import path from 'node:path';
function loadEnvFile(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return;
        const content = fs.readFileSync(filePath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const eq = trimmed.indexOf('=');
            if (eq === -1)
                continue;
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
    catch {
        //
    }
}
loadEnvFile(path.join(process.cwd(), '.env'));
loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), 'env'));
export function requireEnv(name) {
    const val = process.env[name];
    if (!val || !val.trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return val;
}
