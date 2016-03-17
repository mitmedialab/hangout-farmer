# Hangout Farmer

A script using selenium to collect URLs to Google Hangouts.

## Install

1. Clone the repository.

         git clone https://github.com/unhangout/hangout-farmer.git

2. Install dependencies

         npm install

3. Copy `conf.js.example` to `conf.js`, and edit the file to include your
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

## Usage

Once installed and configured, run with `./index.js`.  Hangout URLs will be printed to standard output.
