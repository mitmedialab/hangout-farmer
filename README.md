# Hangout Farmer

A script using selenium to collect URLs to Google Hangouts.

## Install

1. Clone the repository.

         git clone https://github.com/unhangout/hangout-farmer.git

2. Install dependencies

         npm install

3. Make sure [Java JDK](http://www.oracle.com/technetwork/java/javase/downloads/index.html) is installed.

4. Copy `conf.js.example` to `conf.js`, and edit the file to include your
   configuration.  Required parameters are:

     * `googleEmail`: Email address for a valid google account to use to create the links.
     * `googlePassword`: Password for that google account.
     * `startingUrl`: A seed URL to use for creating the links.  The easiest way to get this is to create a calendar event with a video link, and to copy that link.  An example link: `https://plus.google.com/hangouts/_/calendar/dW5oYW5nb3V0ZGV2QGdtYWlsLmNvbQ.scpgoeq5iatpuei1edil98trsc?authuser=0`

   Change these parameters if you like:

     * `count`: The number of links to collect.
     * `firefoxBin`: Path to a specific firefox binary to use.  The firefox binary must have access to the google talk plugin.
     * `seleniumJar`: Path to a selenium standalone server jar to use.  It will be downloaded on first run if not found.
     * `seleniumPort`: Port to which selenium standalone server should bind.
     * `seleniumVerboseLogging`: set to `true` to enable verbose logging of the selenium process.
     * `seleniumJarVersion`: The version of the selenium standalone server jar to download if not present.

## Usage: from the shell

Once installed and configured, run with `./index.js`.  Hangout URLs will be printed to standard output.

## Usage: as a library

Start by installing:

    npm install https://github.com/unhangout/hangout-farmer.git

Functions:

 - `farmUrls(options, urlCallback, doneCallback)`: Farm urls from Google Hangout. Arguments:
     - `options`: An object containing options as described above.
     - `urlCallback`: A function that will be called with each URL or URL retrieval error.  Should take `(err, url)` as arguments.
     - `doneCallback`: Optional, a function that will be called when done with all URLs.
 
 - `buildDriver(options)`: Build a selenium webdriver instance. Arguments:
     - `options`: An objct containing options as described above.
     - returns a Promise which resolves with the ready to use webdriver instance.

Example use:

    #!/usr/bin/env
    "use strict";

    const farmer = require("hangout-farmer");
    const options = {
      googleEmail: "example@gmail.com",
      googlePassword: "seekrit",
      startingUrl: "https://plus.google.com/hangouts/_/dW5oYW5nb3V0ZGV2QGdtYWlsLmNvbQ.h9ugsdd1nafsmsp53ii1rkmlas?authuser=0"
    };
    
    farmer.farmUrls(options, function(err, url) {
        if (err) {
          console.error(err);
        } else {
          console.log(url);
        }
    }, function() {
        console.error("All done!");
    });
