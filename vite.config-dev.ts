import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'url-override',
      /**
       * Changing logged URLs to include the path to the demo directory.
       */
      configureServer: (server) => {
        const printUrls = server.printUrls;

        server.printUrls = () => {
          if (server.resolvedUrls !== null) {
            for (const [key, value] of Object.entries(server.resolvedUrls)) {
              for (let i = 0; i < value.length; i++) {
                server.resolvedUrls[key][i] += "demos/index.html";
              }
            }
          }

          printUrls();
        }
      }
    }
  ],
});
