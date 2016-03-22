#!/usr/bin/env node
"use strict";
const fs = require("fs");
const https = require("https");
const path = require("path");

const FirefoxProfile = require("firefox-profile");
const SeleniumServer = require("selenium-webdriver/remote").SeleniumServer;
const webdriver = require("selenium-webdriver");
const By = webdriver.By;

/**
 * Build the absolute path to the selenium server standalone jar, and download
 * it if necessary.
 * @param {Object} opts - Options as exported by conf.js.
 * @return Promise a promise which resolves to the string path to the selenium
 * server standalone jar.
 */
const getSeleniumJarPath = function(opts) {
  if (!opts.seleniumJar) {
    throw new Error("Please specify `seleniumJar`");
  }
  let seleniumJarPath;
  if (path.isAbsolute(opts.seleniumJar)) {
    seleniumJarPath = opts.seleniumJar;
  } else {
    seleniumJarPath = path.join(__dirname, opts.seleniumJar);
  }

  if (!fs.existsSync(seleniumJarPath)) {
    let v = opts.seleniumJarVersion;
    return new Promise(function(resolve, reject) {
      let url = "https://selenium-release.storage.googleapis.com/" +
        v.split(".").slice(0, 2).join(".") +
        `/selenium-server-standalone-${v}.jar`;
      console.error(`Downloading selenium jar ${url} ...`);
      let file = fs.createWriteStream(seleniumJarPath);
      let request = https.get(url, function(response) {
        response.pipe(file);
        file.on("finish", function() {
          file.close(function() { resolve(seleniumJarPath); })
        });
      }).on("error", function(err) {
        fs.unlink(seleniumJarPath);
        reject(err);
      });
    });
  }
  return Promise.resolve(seleniumJarPath);
}

/**
 * Build a Selenium driver object which is ready to use.
 * @param {Object} opts - Options as exported by conf.js.
 * @return Promise a promise which resolves to the driver object.
 */
module.exports.buildDriver = function(opts) {
  let seleniumServer;
  return getSeleniumJarPath(opts).then(function(seleniumJarPath) {
    let seleniumOpts = {port: opts.seleniumPort};
    if (opts.seleniumVerboseLogging) {
      seleniumOpts.stdio = "inherit";
    }
    if (opts.firefoxBin) {
      seleniumOpts.jvmArgs = ["-Dwebdriver.firefox.bin=" + opts.firefoxBin];
    }
    seleniumServer = new SeleniumServer(seleniumJarPath, seleniumOpts);
    return seleniumServer.start(59000);

  }).then(function() {
    let profile = new FirefoxProfile();
    profile.setPreference("plugin.state.flash", 0);
    profile.setPreference("plugin.state.o1d", 2);
    profile.setPreference("plugin.state.googletalk", 2);
    profile.setPreference("plugin.state.libnpo1d", 2);
    profile.setPreference("plugin.state.libnpgoogletalk", 2);
    return new Promise(function (resolve, reject) {
      profile.encoded(function(encodedProfile) {
        resolve(encodedProfile);
      });
    });
  }).then(function(encodedProfile) {
    let capabilities = webdriver.Capabilities.firefox();
    capabilities.set('firefox_profile', encodedProfile);

    let driver = new webdriver.Builder()
      .usingServer(seleniumServer.address())
      .withCapabilities(capabilities)
      .build();

    driver.manage().timeouts().implicitlyWait(5000);
    return driver.manage().window().setSize(1024, 768).then(function() {
      return driver;
    });
  }).catch(function(err) {
    console.error(err);
    console.error("Error starting selenium server. Exiting.");
    process.exit(1);
  });
};

/**
 * Recursive function for retrieving URLs.
 * @param {WebDriver} driver - The selenium webdriver instance to use.
 * @param {Number} count - Integer number of URLs to retrieve.
 * @param {String} startingUrl - The URL to refresh to obtain new hangout URLs.
 * @param {Function} callback - Function to execute with each link. Should
 * accept (err, url) arguments.
 */
function getNextLink(driver, count, startingUrl, callback) {
  let recurse = function() { getNextLink(driver, count, startingUrl, callback); }
  let linkSel = By.css("input[value^='https://hangouts.google.com/call/']");
  let abort = false;
  driver.get(startingUrl);
  driver.wait(function() {
    return driver.findElement(linkSel).then(function(el) {
      return el.isDisplayed();
    }).then(null, function(err) {
      return false;
    });
  }, 20000).then(null, function(err) {
    abort = true;
    recurse();
  }).then(function() {
    if (abort) {
      return;
    }
    driver.findElement(linkSel).then(function(el) {
      return el.getAttribute("value").then(function(value) {
        if (value) {
          callback(null, value && value.replace("/call/", "/hangouts/_/"));
          count--;
          if (count > 0) {
            recurse();
          }
        } else {
          callback(new Error("Link not found in dom."));
          recurse();
        }
      });
    });
  });
};

/**
 * Farm hangout URLs, printing them to stdout.
 * @param {Object} opts - Object containing the following options:
 *  - googleEmail: {String}, email for google account to use.
 *  - googlePassword: {String}, password for google account.
 *  - startingUrl: {String}, URL for a google calendar invite to start from.
 *  - count: {Number}, integer number of URLs to retrieve.
 *  - seleniumJar: {String}, path to selenium jar to use. It will be downloaded
 *    if it doesn't exist.
 *  - seleniumPort: {Number}, integer port to use for selenium.
 *  - seleniumVerboseLogging: {Boolean}, set true to ask selenium to log verbosely
 *  - seleniumJarVersion: {String}, version string for selenium jar to download
 *    if not present.
 */
module.exports.farmUrls = function(opts, callback, done) {
  opts = Object.assign({
    "count": 100,
    "seleniumJar": "vendor/selenium-server-standalone.jar",
    "firefoxBin": "",
    "seleniumPort": 4444,
    "seleniumVerboseLogging": false,
    "seleniumJarVersion": "2.53.0",
  }, opts);
  ["googleEmail", "googlePassword", "startingUrl"].forEach(function(key) {
    if (!opts[key]) {
      throw new Error(`Missing required option ${key}`);
    }
  });

  module.exports.buildDriver(opts).then(function(driver) {
    driver.get("https://accounts.google.com/ServiceLogin");
    // Authenticate
    driver.findElement(By.css("#Email")).sendKeys(opts.googleEmail);
    driver.findElement(By.css("[name=signIn]")).click();
    driver.findElement(By.css("#Passwd")).sendKeys(opts.googlePassword);
    driver.findElement(By.css("#signIn")).click();
    driver.getCurrentUrl().then((function(url) {
      if (url.indexOf("AccountRecovery") !== -1) {
        driver.findElement(By.css("#cancel")).click();
      }
    }));
    driver.wait(function() {
      return driver.getCurrentUrl().then(function(url) {
        return url.indexOf("https://myaccount.google.com") === 0;
      });
    });
    getNextLink(driver, opts.count, opts.startingUrl, callback);
    driver.quit().then(function() {
      done && done();
    });
  });
};

if (require.main === module) {
  module.exports.farmUrls(require("./conf.js"), function(err, url) {
    if (err) {
      console.error(err);
    } else {
      console.log(url);
    }
  }, function(err) {
    console.error("done");
  });
};
