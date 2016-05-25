/**
 * Created by pa on 06/04/16.
 */

(function() {
    "use strict";

    var scriptUrl = new Error().stack.match(/(https?:\/\/.+):\d+:\d+/)[1];
    var PREVENT_SHARED_WORKER = false;
    var loaded = false;
    var defaultContext = undefined;
    var rules; // set by workerHandlerMessage

    var port = connectToWorker();
    port.postMessage(window.location.toString());
    var gui = prepareGui();

    var tabId = sessionStorage.getItem('tabId');
    if (!tabId) {
        tabId = new Date().getTime().toString(36);
        sessionStorage.setItem('tabId', tabId);
    }
    console.log("tabId", tabId);

    window.addEventListener('load', function() {
        document.body.appendChild(gui);
        loaded = true;
    });

    /**
     * Prepares the GUI notifying the user they are being traced.
     */
    function prepareGui() {
        var head = document.getElementsByTagName("head")[0];
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = scriptUrl.replace('tracingyou.js', 'tracingyou.css');
        link.type = 'text/css';
        head.appendChild(link);

        gui = document.createElement("label");
        gui.id = "tracingyou-gui";
        gui.style.display = 'none';
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !sessionStorage.getItem('tracingyou-disabled');
        checkbox.addEventListener('change', function() {
            sessionStorage.setItem('tracingyou-disabled', checkbox.checked?'':'disabled');
        });
        gui.appendChild(checkbox);
        return gui;
    }

    /**
     * Create the most appropriate supported worker for posting obsels.
     */
    function connectToWorker() {
        if (window.SharedWorker && !PREVENT_SHARED_WORKER) {
            var workerUrl = scriptUrl.replace('tracingyou.js', 'sharedworker.js');
            //console.log(workerUrl);
            var worker = new SharedWorker(workerUrl);
            port = worker.port;
            //port.addEventListener('message', workerMessageHandler);
            port.onmessage = workerMessageHandler;
            port.start();
            //worker.onerror = console.error.bind(console);
        } else {
            console.error("simple worker no implemented yet");
            // TODO implement simpleworker.js and uncomment code below
            //workerUrl = scriptUrl.replace('tracingyou.js', 'simpleworker.js');
            //console.log(workerUrl);
            //worker = new Worker(workerUrl);
            //worker.onmessage = workerMessageHandler;
            //port = worker;
        }
        //console.log(port);
        return port;
    }

    /**
     * Hanlde message received from the worker.
     * Actually, the worker will only send one message,
     * containing the observation rules for this page.
     * @param evt
     */
    function workerMessageHandler(evt) {
        //console.log('workerMessageHandler', evt.data, evt);

        if (evt.data.rules !== undefined) {
            // This is the first message from the worker.
            // add link to help
            var help = document.createElement('a');
            help.textContent = '?';
            help.href = evt.data.helpUrl;
            help.target = '_blank';
            gui.appendChild(help);
            defaultContext = evt.data.defaultContext;
            rules = evt.data.rules || [];
            if (loaded) {
                makeAllListenersForRules();
            } else {
                window.addEventListener('load', makeAllListenersForRules)
            }
        } else {
            // This is a further message from the worker.
            gui.querySelector('input').checked = evt.data.record;
        }
    }

    /**
     * Handle all the rules sent by the worker.
     * Assumes that the window is loaded.
     */
    function makeAllListenersForRules() {
        for (var i=0; i<rules.length; i+=1) {
            gui.style.display = null; // show GUI by restoring default mode
            var rule = rules[i];
            makeListenerForRule(rule);
        }
        window.dispatchEvent(new Event('tracingyou-configured'));
    }

    /**
     * Make an event listener for the given rule.
     * @param rule
     */
    function makeListenerForRule(rule) {
        console.log("makeListenerForRule", rule);
        var eventListener = function(evt) {
            //console.log("eventListener", evt)
            var checkbox = gui.children[0];
            if ((checkbox.checked || rule.force)
                && (!rule.filter || evt.target.matches && evt.target.matches(rule.filter))) {
                var json = JSON.stringify(rule.template);
                json = json.replace(
                    /"{([^}]+)}"/g,
                    function(match) {
                        var key = match.substr(2, match.length-4);
                        if (key === 'tabId') {
                            value = tabId;
                        }
                        else if (key === 'time') {
                            value = new Date().getTime();
                        }
                        else if (key === 'url') {
                            value = location.toString();
                        }
                        else if (key === 'selector') {
                            value = getSelector(evt.target);
                        }
                        else if (key === 'label') {
                            var target = evt.target;
                            var labels = target.labels;
                            if (labels && labels[0]) {
                                value = labels[0].textContent;
                            } else if (target.placeholder) {
                                value = target.placeholder;
                            } else if (target.tagName == 'BUTTON') {
                                value = target.textContent;
                            } else if (target.tagName == 'SELECT') {
                                value = target.children[0].textContent;
                            } else if (target.tagName == 'INPUT' &&
                                target.type.match(/submit|reset|button/)) {
                                value = target.value;
                            } else {
                                value = null;
                            }
                        }
                        else if (key[0] === '@') {
                            var attr_chain = key.substr(1).split('.');
                            var value = attr_chain.reduce(
                                function (value, attr) {
                                    return value[attr]
                                }, evt);
                            if (!value) value = null;
                        }
                        else {
                            value = match;
                        }
                        return JSON.stringify(value);
                    }
                );
                var obsel = JSON.parse(json);
                if (obsel['@context'] === undefined
                    && defaultContext !== undefined) {
                    obsel['@context'] = defaultContext;
                }
                console.log("Sending obsel to worker", obsel);
                port.postMessage(obsel);
            }
        };
        var targets;
        if (rule.selector) {
            targets = document.querySelectorAll(rule.selector);
        } else {
            targets = [window];
        }
        for (var i=0; i<targets.length; i++) {
            targets[i].addEventListener(rule.event, eventListener);
        }
    }

    /**
     * Return an unambiguous CSS selector for the given element.
     * @param element
     * @param suffix (for internal purposes only)
     * @returns {String}
     */
    function getSelector(element, suffix) {
        // derived from http://stackoverflow.com/a/3454579/1235487
        var selector;
        if (element === undefined || element === null) {
            return null;
        }
        else if (element.nodeType !== Node.ELEMENT_NODE) {
            return getSelector(element.parentNode);
        }

        var tagName = element.tagName;
        if (element.id) {
            selector = tagName.toLowerCase() + '#' + element.id;
        }
        else if (tagName == "BODY" || tagName == "HEAD") {
            selector = tagName.toLowerCase();
        }
        else {
            var sameTags = Array.prototype.filter.call(
                element.parentNode.children,
                function (e) { return e.tagName === tagName }
            );
            var rank = "";
            if (sameTags.length > 1) {
                rank = ':nth-of-type(' + (sameTags.indexOf(element)+1) + ')';
            }
            selector = getSelector(element.parentNode,
                tagName.toLowerCase() + rank);
        }
        if (suffix) {
            selector += ' > ' + suffix;
        } else {
            //console.log("selector test:", document.querySelector(selector));
        }
        return selector;
    }

}());

