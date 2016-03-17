#!/usr/bin/env node
var fs = require("fs");
var https = require("https");
var path = require("path");

var FirefoxProfile = require("firefox-profile");
var SeleniumServer = require("selenium-webdriver/remote").SeleniumServer;
var webdriver = require("selenium-webdriver");
var By = webdriver.By;

var conf = require("./conf")

/**
 * Build the absolute path to the selenium server standalone jar, and download
 * it if necessary.
 * @return Promise a promise which resolves to the string path to the selenium
 * server standalone jar.
 */
var getSeleniumJarPath = function() {
  if (!conf.seleniumJar) {
    throw new Error("Please specify `seleniumJar` in conf.js");
  }
  var seleniumJarPath;
  if (path.isAbsolute(conf.seleniumJar)) {
    seleniumJarPath = conf.seleniumJar;
  } else {
    seleniumJarPath = path.join(__dirname, conf.seleniumJar);
  }

  if (!fs.existsSync(seleniumJarPath)) {
    var v = conf.seleniumJarVersion;
    return new Promise(function(resolve, reject) {
      var url = "https://selenium-release.storage.googleapis.com/" +
        v.split(".").slice(0, 2).join(".") +
        "/selenium-server-standalone-" + v + ".jar";
      console.error("Downloading selenium jar " + url + " ...");
      var file = fs.createWriteStream(seleniumJarPath);
      var request = https.get(url, function(response) {
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
 * @return Promise a promise which resolves to the driver object.
 */
var buildDriver = function() {
  var seleniumServer;
  return getSeleniumJarPath().then(function(seleniumJarPath) {
    var opts = {port: conf.seleniumPort};
    if (conf.seleniumVerboseLogging) {
      opts.stdio = "inherit";
    }
    if (conf.firefoxBin) {
      opts.jvmArgs = ["-Dwebdriver.firefox.bin=" + conf.firefoxBin];
    }
    seleniumServer = new SeleniumServer(seleniumJarPath, opts);
    return seleniumServer.start(59000);

  }).then(function() {
    var profile = new FirefoxProfile();
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
    var capabilities = webdriver.Capabilities.firefox();
    capabilities.set('firefox_profile', encodedProfile);

    var driver = new webdriver.Builder()
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
 * Farm hangout URLs, printing them to stdout.
 */
var main = function() {
  buildDriver().then(function(driver) {
    driver.get("https://accounts.google.com/ServiceLogin");
    // Authenticate
    driver.findElement(By.css("#Email")).sendKeys(conf.googleEmail);
    driver.findElement(By.css("[name=signIn]")).click();
    driver.findElement(By.css("#Passwd")).sendKeys(conf.googlePassword);
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
    getNextLink(driver, conf.count);

  });
};

function getNextLink(driver, count) {
  var linkSel = By.css("input[value^='https://hangouts.google.com/call/']");
  var abort = false;
  driver.get(conf.startingUrl);
  driver.wait(function() {
    return driver.findElement(linkSel).then(function(el) {
      return el.isDisplayed();
    }).then(null, function(err) {
      return false;
    });
  }, 20000).then(null, function(err) {
    abort = true;
    getNextLink(driver, count);
  }).then(function() {
    if (abort) {
      return;
    }
    driver.findElement(linkSel).then(function(el) {
      return el.getAttribute("value").then(function(value) {
        if (value) {
          console.log(value && value.replace("/call/", "/hangouts/_/"));
          if (count > 0) {
            getNextLink(driver, count - 1);
          }
        } else {
          console.error("Link not found");
          getNextLink(driver, count);
        }
      });
    });
  });

};

if (require.main === module) {
  main();
};
