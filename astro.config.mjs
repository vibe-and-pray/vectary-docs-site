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
      customCss: [
        './src/styles/custom.css',
      ],
      sidebar: [
        {
          label: 'Welcome to Vectary Docs',
          link: '/',
        },
        {
          label: 'Getting Started',
          collapsed: true,
          autogenerate: { directory: 'documentation/getting-started' },
        },
        {
          label: 'Importing',
          collapsed: true,
          autogenerate: { directory: 'documentation/importing' },
        },
        {
          label: 'Design Process',
          collapsed: true,
          items: [
            {
              label: 'Design mode',
              collapsed: true,
              items: [
                { slug: 'documentation/design-process/design-mode', label: 'Overview' },
                { slug: 'documentation/design-process/design-mode/selections-tools' },
                { slug: 'documentation/design-process/design-mode/primitives' },
                { slug: 'documentation/design-process/design-mode/3d-text' },
                { slug: 'documentation/design-process/design-mode/light-sources' },
                {
                  label: 'Modifiers',
                  collapsed: true,
                  autogenerate: { directory: 'documentation/design-process/design-mode/modifiers' },
                },
                {
                  label: 'Deformers',
                  collapsed: true,
                  autogenerate: { directory: 'documentation/design-process/design-mode/deformers' },
                },
                { slug: 'documentation/design-process/design-mode/interactive-elements' },
                {
                  label: 'Setup',
                  collapsed: true,
                  autogenerate: { directory: 'documentation/design-process/design-mode/setup' },
                },
              ],
            },
            { label: 'Materials and textures', collapsed: true, autogenerate: { directory: 'documentation/design-process/materials-and-textures' } },
            { slug: 'documentation/design-process/animated-materials' },
            { slug: 'documentation/design-process/decals' },
            { slug: 'documentation/design-process/camera' },
            { slug: 'documentation/design-process/environment' },
            { slug: 'documentation/design-process/background' },
            { slug: 'documentation/design-process/ground-plane' },
            { label: 'Effects', collapsed: true, autogenerate: { directory: 'documentation/design-process/effects' } },
            { label: 'Control bar', collapsed: true, autogenerate: { directory: 'documentation/design-process/control-bar' } },
            { label: 'Libraries', collapsed: true, autogenerate: { directory: 'documentation/design-process/libraries' } },
            { label: 'Edit mode', collapsed: true, autogenerate: { directory: 'documentation/design-process/edit-mode' } },
          ],
        },
        {
          label: 'Sharing & Exporting',
          collapsed: true,
          autogenerate: { directory: 'documentation/sharing-and-exporting' },
        },
        {
          label: 'Embedding',
          collapsed: true,
          autogenerate: { directory: 'documentation/embedding' },
        },
        {
          label: 'Model API',
          collapsed: true,
          autogenerate: { directory: 'api/model-api' },
        },
        {
          label: 'Tutorials',
          collapsed: true,
          autogenerate: { directory: 'tutorials' },
        },
        {
          label: 'Showcases',
          collapsed: true,
          autogenerate: { directory: 'showcases' },
        },
        {
          label: 'Changelog',
          collapsed: true,
          autogenerate: { directory: 'changelog' },
        },
      ],
    }),
  ],
});
