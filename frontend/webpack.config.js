const path = require("path");

module.exports = {
  mode: "production",
  entry: {
    background: "./background/background.js",
    content: "./content/content.js"
  },
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
  }
};