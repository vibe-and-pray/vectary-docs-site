import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://vibe-and-pray.github.io',
  base: '/vectary-docs-site',
  trailingSlash: 'never',
  integrations: [
    starlight({
      title: 'Vectary Docs',
      logo: {
        src: './src/assets/vectary-logo.svg',
        replacesTitle: true,
      },
      social: {
        github: 'https://github.com/vibe-and-pray/vectary-docs',
      },
      customCss: [
        './src/styles/custom.css',
      ],
      sidebar: [
        {
          label: 'Getting Started',
          autogenerate: { directory: 'documentation/getting-started' },
        },
        {
          label: 'Importing',
          autogenerate: { directory: 'documentation/importing' },
        },
        {
          label: 'Design Process',
          autogenerate: { directory: 'documentation/design-process' },
        },
        {
          label: 'Sharing & Exporting',
          autogenerate: { directory: 'documentation/sharing-and-exporting' },
        },
        {
          label: 'Embedding',
          autogenerate: { directory: 'documentation/embedding' },
        },
        {
          label: 'Model API',
          autogenerate: { directory: 'api/model-api' },
        },
        {
          label: 'Tutorials',
          autogenerate: { directory: 'tutorials' },
        },
        {
          label: 'Showcases',
          autogenerate: { directory: 'showcases' },
        },
        {
          label: 'Changelog',
          autogenerate: { directory: 'changelog' },
        },
      ],
    }),
  ],
});
