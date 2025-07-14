# expo-edge-speech Documentation Website

This directory contains the Docusaurus website for the expo-edge-speech documentation.

## Development

### Installation

```bash
cd website
npm install
```

### Local Development

```bash
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment is handled by the GitHub Action in `.github/workflows/deploy-docs.yml`.

## Structure

- `docs/` - Contains the actual documentation markdown files (located in the parent directory)
- `src/` - Contains the React components for the website
- `static/` - Contains static assets like images
- `docusaurus.config.ts` - Docusaurus configuration file
- `sidebars.ts` - Sidebar configuration

## Documentation Sources

The documentation content is sourced from the `../docs/` directory:

- `intro.md` - Getting started guide
- `api-reference.md` - Complete API documentation
- `usage-examples.md` - Usage examples and patterns
- `configuration.md` - Configuration options
- `platform-considerations.md` - Platform-specific information
- `typescript-interfaces.md` - TypeScript type definitions
- `DEVELOPMENT-workflow.md` - Development workflow (for contributors)
