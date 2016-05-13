/**
 * Created by pa on 06/04/16.
 */
"use strict";
var scriptUrl = new Error().stack.match(/(https?:\/\/.+):\d+:\d+/)[1];

console.log("shared worker started", scriptUrl);

onconnect = function(evt) {
    var port = evt.ports[0];
    port.addEventListener('message', function(evt) {
        var msg = evt.data;
        //console.log("message reveived", msg);
        if (typeof(msg) === 'string') {
            whenConfigReady(function() {
                sendConfig(msg, port);
            });
        } else {
            enqueueObsel(msg);
        }
    });
    port.start();
    console.log("shared worker connected");
};

onerror = function(msg, filename, linenumber) {
    console.error(new Error(msg, filename, linenumber));
};

/**
 * Send the configuration for the given url to the given port.
 * Assumes that config has been correctly loaded.
 * @param url
 * @param port
 */
function sendConfig(url, port) {
    //console.log("sendConfig", url, port);
    var helpUrl = config.helpUrl || "#help"; // TODO provide a generic help URL
    var rules = [];
    var rulesets = config.rulesets || {};
    for (var regex in rulesets) {
        if (!rulesets.hasOwnProperty(regex)) continue;
        if(url.match(regex)) {
            rules = rules.concat(rulesets[regex]);
        }
    }
    port.postMessage({ helpUrl: helpUrl, rules: rules });
}

/**
 * Enqueue the obsel for posting to the configured trace.
 * @param obsel
 */
function enqueueObsel(obsel) {
    //console.log("enqueueObsel", obsel);
    obselQueue.push(obsel);
    if (obselQueue.length === 1 && obselXhr === null) {
        whenConfigReady(sendObsels);
    }
}
var obselQueue = [];
var obselXhr = null;

/**
 * Sends the obsels in obselQueue to the configured trace.
 * Asssumes that config has been correctly loaded, obselXhr is null and obselQueue is not empty.
 * Also, ensures that a delay of 'config.postDelay' ms is kept between two queries.
 */
function sendObsels() {
    //console.log("sendObsels", obselXhr === null);
    obselXhr = new XMLHttpRequest();
    obselXhr.open('POST', config.traceUri);
    obselXhr.withCredentials = true;
    obselXhr.setRequestHeader('content-type', 'application/json');
    obselXhr.onerror = function () {
        console.error("error posting obsels: no response");
    };
    obselXhr.onload = function () {
        //console.log('obselXhr.onload', obselXhr);
        if (obselXhr.status !== 201) {
            console.error("error posting obsels:", obselXhr.status,
                obselXhr.statusText, obselXhr.responseText);
        } //else console.log('POST request succeeded');
        setTimeout(function () {
            obselXhr = null;
            if (obselQueue.length) sendObsels();
        }, config.postDelay || 1000);

    };
    obselXhr.send(JSON.stringify(obselQueue));
    console.log("POST request sent to ", config.traceUri, "(", obselQueue.length, ")");
    obselQueue = [];
}


/**
 * Call the given callback as soon as the config has been loaded.
 * @param callback
 */
function whenConfigReady(callback) {
    //console.log("whenConfigReady", config);
    if (config === null) {
        configXhr.addEventListener('config-ready', callback);
    } else {
        callback();
    }
}

var config = null;
var configUrl = scriptUrl.replace('sharedworker.js', 'config.json');
var configXhr = new XMLHttpRequest();
configXhr.open('GET', configUrl);
configXhr.onerror = function() {
    console.error("error loading config: no response");
};
configXhr.onload = function() {
    if (configXhr.status !== 200) {
        console.error("error loading config: ", configXhr.responseText);
    } else {
        console.log('GOT config from', configUrl);
        config = JSON.parse(configXhr.responseText);
        //console.log("dispatching config-ready");
        configXhr.dispatchEvent(new Event('config-ready'));
    }
};
configXhr.send();
//console.log("GET request sent to ", configUrl);
