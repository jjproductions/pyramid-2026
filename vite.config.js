import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const getVersion = () => {
  try {
    const commitMsg = execSync('git log -n 5 --oneline').toString().trim();
    const match = commitMsg.match(/Beta\s*\d+\.\d+\.\d+/i);
    if (match) return match[0];
  } catch (err) {}
  return 'Development';
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(getVersion())
  }
})
