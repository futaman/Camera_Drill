import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages ではリポジトリ名のサブパスで配信される
export default defineConfig({
  base: './',
  plugins: [react()],
});
