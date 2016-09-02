This is a generic collector for kTBS_, to be embedded in any website.

Install
-------

You have to install on your HTTP server:
* all the JS files,
* ``traceme.css``, and
* a ``config.json`` file (see below).

NB: it is important that those files are accessible under the *same origin*
(protocol, domain name and port) as your web app.

The structure of ``config.json`` is as follow:

* ``traceUri``: the URI of the trace to POST obsels to (required)
* ``postDelay``: how many ms between each POST (defaults to 1000)
* ``helpUrl``: the URL of the help page for the collector(defaults to a generic help page)
* ``defaultContext``: a JSON-LD context object to be added (as ``@context``) to any obsel having none
* ``rulesets``: an object whose attributes are regexp, and values are arrays of rules (see below).

Each ruleset will be applied to all URLs matching the regex.
A rule is an object with the following attributes:

* ``event``: the event to listen to
* ``filter``, ``selector``: the elements on which to listen to (see below for the difference)
* ``template``: a template JSON object for the obsel to produce
* ``force``: a boolean indicating that the rule must apply even when tracing was disabled by the user
* ``throttle``: a number indicating the minimum delay (in ms) between two applications of that rule

In the template, strings of the form ``"{X}"`` will be substituted as follow:

* ``{tabId}``: an unique ID identifying the current tab
* ``{time}``: the current timestamp
* ``{url}``: the current URL
* ``{xpath}``: the XPath of the target element
* ``{label}``: an appropriate label for a form element
* ``{@X}``: the attribute X of the event -- can also be {@X.Y}, {@X.Y.Z}, etc.

Difference between ``filter`` and ``selector``
``````````````````````````````````````````````

The elements on which a rule applies can be specified by ``filter`` or ``selector``.
Both expect an aribitrary CSS selector.
The short story is: you should in general prefer ``filter``.

With ``filter``, the event listener is set once and for all on the ``window``,
but it automatically stops if the target element does not match the ``filter``.
With ``selector``, the event listener is added to the every element matching the selector.
Not only is it more work for the browser,
but if matching elements are created afterwards (by JS code),
they will not have the event listener
(while with ``filter``, the global listener will take them into account).

There are still some cases where you should use ``selector``:
when listening to events that do not *bubble*,
as those are not visible on the ``window``.

NB: if you want to listen on events on ``window`` itself,
you can simply omit both ``filter`` and ``selector``.

Custom events
`````````````

* ``traceme-configured`` is dispatched on the ``window`` whenever the script is configured;
  it is useful to post an obsel just after the page has been loaded.


Requirements
------------

The trace to which you POST must have 1970-01-01T00:00:00Z as its origin,
and its model must be consistent with the templates in config.json.

Implementation
--------------

The tracingyou.js starts by creating a minimal GUI in the page,
to make the user aware that they are being traced,
and allow them to temporarily\ [#disabling-tracing]_ disable tracing
(it is not displayed, though, on pages where no rule apply).

It also creates a worker (a shared worker if supported by the browser)
to handle AJAX queries (configuration reading and communication with kTBS).

Here are the messages that the script and the worker can exchange:

* When the script is loaded,
  it first sends the URL of the page (as a string) to the worker;

* The worker then sends a prepared version of the config object,
  containing:

  + ``helpUrl`` from ``config.json``
  + ``defaultContext`` from ``config.json``
  + ``rules`` contains an array of rules (see above) that apply to that page

  The script adds the ``helpUrl`` in its GUI,
  and creates an event listener corresponding to each rule.

* Any other message sent by the script to the worker is interpreted as an obsel,
  which will be sent to the configured trace.

* The worker may also send further messages to turn the recording off,
  to indicate a problem with the server.


.. [#disabling-tracing] it uses sessionStorage,
   so disabling only applies to the current browser tab.

.. _ktbs: http://tbs-platform.org/ktbs
