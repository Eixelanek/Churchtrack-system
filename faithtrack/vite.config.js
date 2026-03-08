import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certDir = path.resolve(__dirname, 'certs');
const keyPath = path.join(certDir, 'dev-key.pem');
const certPath = path.join(certDir, 'dev-cert.pem');

const httpsConfig = fs.existsSync(keyPath) && fs.existsSync(certPath)
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://churchtrack-api.onrender.com')
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 3000,
    strictPort: true, // This will make Vite fail if port is not available instead of trying another port
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
