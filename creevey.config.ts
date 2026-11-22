import { CreeveyConfig } from 'creevey';
import { PlaywrightWebdriver } from 'creevey/playwright';

const config: CreeveyConfig = {
  webdriver: PlaywrightWebdriver,
  useDocker: false,

  // The URL where your Storybook is hosted
  storybookUrl: 'http://localhost:6006',

  // Define which browsers to use for testing
  browsers: {
    chromium: {
      // The browser type name which will be used by Playwright
      browserName: 'chromium',
      // Default viewport dimensions
      viewport: { width: 1200, height: 800 },
      // Limit of retries for failed tests
      maxRetries: 2,
    },
  },
};

export default config;
