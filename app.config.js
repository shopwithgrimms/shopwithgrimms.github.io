const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").pop();
const isAccountSite = repositoryName?.endsWith(".github.io");

const pagesBaseUrl =
  process.env.GITHUB_ACTIONS === "true" && repositoryName && !isAccountSite
    ? `/${repositoryName}`
    : "";

module.exports = ({ config }) => ({
  ...config,
  name: "GRIMMS Business Tracker",
  slug: "grimms-business-tracker",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  description: "A browser-based tracker for a small creative business.",
  experiments: {
    ...config.experiments,
    baseUrl: pagesBaseUrl
  },
  web: {
    ...config.web,
    bundler: "metro",
    output: "single",
    name: "GRIMMS Business Tracker",
    shortName: "GRIMMS Tracker"
  }
});
