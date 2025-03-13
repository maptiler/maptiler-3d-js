import { defineConfig } from 'vite';
import esConfig from './vite.config-es';

export default defineConfig({
    ...esConfig,
    // publicDir: './',
    // plugins: [
      // ...(esConfig.plugins ?? []),
    //   {
    //   name: 'url-override',
    //   /**
    //    * Changing logged URLs to include the path to the demo directory.
    //    */
    // }
  // ],
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
