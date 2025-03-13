import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        mapLoad: 'public/mapLoad.html',
        // about: 'fixtures/about.html',
        // contact: 'fixtures/contact.html',
      },
    },
  },
    root: './e2e',
});
