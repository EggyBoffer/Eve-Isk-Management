export default {
  packagerConfig: {},
  rebuildConfig: {
    ignoreModules: ["better-sqlite3"],
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux", "win32"],
      config: {},
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "EggyBoffer",
          name: "Eve-Isk-Management",
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};