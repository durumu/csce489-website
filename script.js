function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const screen = document.getElementById("screen");
const start = document.getElementById("start");
const stop = document.getElementById("stop");
const load = document.getElementById("load");

const DELAY = 200; // ms

const filename = '10KwithErrors.txt'
// const filename = 'test.txt'

var started = false;
//var manuallyStopped = true;

var errors = [0, 1, 1, 1, 0];

var ledStates = {
  "air" : 0,
  "comm" : 0,
  "power" : 0,
  "load" : 0,
  "manager": 0,
  "start" : 0,
  "stop" : 0
};

var ledNames = {
  "air" : ["led-off-air", "led-air-red", "led-air-green"],
  "comm" : ["led-off-comm", "led-communication-red", "led-communication-green"],
  "power" : ["led-off-power", "led-power-red", "led-power-green"],
  "load" : ["led-off-load", "load-light"],
  "manager" : ["led-off-manager", "led-on-manager"],
  "stop" : ["led-off-Stop", "led-on-Stop"],
  "start" : ["led-off-Start", "led-on-Start"],
}

var pressed = {
  "load" : false,
  "start": false,
  "stop" : false
};

var waitingForPress = {
  "load" : false,
  "start": false,
  "stop" : false
};

function press(name) {
  if (waitingForPress[name])
    pressed[name] = true;
}

function updateLEDState() {
  ledStates["start"] = 0;
  ledStates["stop"] = 0;
  ledStates["manager"] = 0;

  var names = ["power", "comm", "air"];
  for (var i = 0; i < names.length; ++i) {
    if (!started) ledStates[names[i]] = 0;
    else if (errors[i+1] == 0) {
      ledStates[names[i]] = 1;
      ledStates["start"] = 1;
      ledStates["manager"] = 1;
    }
    else ledStates[names[i]] = 2;
  }

  if (errors[4] == 1) {
    ledStates["start"] = 0;
    ledStates["stop"] = 1;
    ledStates["manager"] = 1;
  }

  ledStates["load"] = waitingForPress["load"] ? 1 : 0;
  // and draw them
  Object.keys(ledNames).forEach(drawLED);
}

function drawLED(name) {
  for (var i = 0; i < ledNames[name].length; ++i) {
    var led = document.getElementsByClassName(ledNames[name][i])[0];
    console.log(led.position);
    if (i == ledStates[name]) led.style.visibility = "visible";
    else led.style.visibility = "hidden";
  }
}

async function waitForPress(name) {
  waitingForPress[name] = true;
  updateLEDState();
  while (!pressed[name]) await sleep(100);
  pressed[name] = false;
  waitingForPress[name] = false;

  screen.value += "\nCORRECT RESPONSE";
  await sleep(500);
}

function isErrorState() {
  for (var i = 0; i < errors.length - 1; ++i)
    if (errors[i] == 0) return true;
  return errors[4] == 1;
}

function displayErrors() {
  var errorCode = "ERROR:\n";
  if (errors[0] == 0)
    errorCode += "NOT READY\n";
  if (errors[1] == 0)
    errorCode += "POWER OFF\n";
  if (errors[2] == 0)
    errorCode += "NETWORK OFF\n";
  if (errors[3] == 0)
    errorCode += "AIR OFF\n";
  if (errors[4] == 1)
    errorCode += "EMERGENCY STOP\n";
  screen.value += errorCode;
}

async function process(line) {
  updateLEDState();

  var sysCode = parseInt(line.split("\t")[0]);
  var infoCode = parseInt(line.split("\t")[1]);

  screen.value = "";
  // screen.value = line + "\n" + infoCode + "\n";

  if (sysCode <= 4) {
    errors[sysCode] = infoCode;
  } else if (sysCode == 5 && infoCode == 0) {
    errors[0] = 1;
  }

  if (isErrorState()) {
    displayErrors();

    if (errors[4] == 1) {
      screen.value += "\nPLEASE CALL MANAGER THEN";
      screen.value += "\nPRESS \"Stop\" TO CONTINUE";
      await waitForPress("stop");
    } else if (errors[1] == 0 || errors[2] == 0 || errors[3] == 0) {
      screen.value += "\nPLEASE CALL MANAGER THEN";
      screen.value += "\nPRESS \"Start\" TO CONTINUE";
      await waitForPress("start");
    }

    return;
  }

  if (sysCode == 5 && infoCode != 0) {
    screen.value += "ITEM LOADED\nLOCATION: " + infoCode + "\n";
  } else if (sysCode == 6 || sysCode == 7) {
    if (sysCode == 6) screen.value += "MISSING ITEM";
    else screen.value += "UNEXPECTED ITEM";
    screen.value += "\nLOCATION: " + infoCode + "\n";
    screen.value += "PLEASE PRESS \"Load\" TO CONTINUE";
    await waitForPress("load");
  } else {
    return;
  }
}

async function processAllLines(lines) {
  for (var i = 0; i < lines.length; ++i) {
    // while (manuallyStopped) await sleep(100);
    await process(lines[i]);
    await sleep(DELAY);
  }
}

start.onclick = function() {
  if (!started) {
    fetch(filename)
      .then(response => response.text())
      .then(function(text){
        var lines = text.split("\n");
        processAllLines(lines);
      });
    started = true;
  } else {
    press("start");
  }
}

stop.onclick = function() {
  press("stop");
}

load.onclick = function() {
  press("load");
}

updateLEDState();
