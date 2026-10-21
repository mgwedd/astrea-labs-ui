const sharedConfig = require("../../packages/ui/tailwind.config.js")

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...sharedConfig,
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.mdx",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [...(sharedConfig.plugins ?? []), require("@tailwindcss/typography")],
}
