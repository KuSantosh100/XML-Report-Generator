const { join, resolve } = require("path");
_ = require("underscore");
require("dotenv").config();
require("app-module-path").addPath(__dirname + "/app/modules");
config = require(resolve(join(__dirname, "app", "config")));

cronTasks = require("./jobTasks.js");

var CronJob = require("cron").CronJob;

let isRunning = false;
databaseInit();
const job = new CronJob("0 * * * * *", function () {
  const d = new Date();

  if (!isRunning) {
    isRunning = true;

    setTimeout(async function () {
      await cronTasks.executeCron();
      isRunning = false;
    }, 3000);
  }
});
job.start();

async function databaseInit() {
  try {
    await require(resolve(join(__dirname, "app", "database")))();
  } catch (error) {
    console.error(error);
  }
}
