[![PR Validation](https://github.com/EggyBoffer/Eve-Isk-Management/actions/workflows/pr-verification.yaml/badge.svg)](https://github.com/EggyBoffer/Eve-Isk-Management/actions/workflows/pr-verification.yaml)

![GitHub package.json version](https://img.shields.io/github/package-json/v/EggyBoffer/Eve-Isk-Management)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/EggyBoffer/Eve-Isk-Management/total)


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Publishing a Build

In order to publish a build, you must create versioned tag. You can do this by saying:

```
git tag v0.0.1
git push origin v0.0.1
```

The problem you can run into is that now your package version is out of tag of your tag. To best handle that, you would want to push an update that increments the version, and then create a tag with that version to ensure it is insync.

Note: You can create actions that auto-increment package tags AND tag, but it shouldnt be needed at this point.

If you want to add more platforms, such as using linux, you need to adjust the build matrics to add it as a build option. There may be additional workflow bugs you need to address for that explicit flow such as changing the forge config.

## Platforms Supported

### Windows 32

Tested and seems to work fine with building a bundle.

### MacOS

Tested and works when using the commands locally, however due to pipeline constraints, it may take longer for the macos-latest container to be available from Github to run the builds, so they may not deploy simultaneously.

### Linux

Currently not supported but can be extended to cover it code owner wishes to support it.
