export default {
  packagerConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux", "win32"],
      config: {
        // identity: null, // Disable code signing for the maker
        // the config can be an object
      },
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
