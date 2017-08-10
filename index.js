#! /usr/bin/env node

'use strict';

// import Sugar to do some cool tricks on memories

var _rxjs = require('rxjs');

var _rxjs2 = _interopRequireDefault(_rxjs);

var _processSpeech = require('./controllers/process-speech');

var _processSpeech2 = _interopRequireDefault(_processSpeech);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('sugar/polyfills/es6');
var Sugar = require('sugar');

// import json reader
var jsonfile = require('jsonfile');

// third parties libraries


// classes


module.exports = function () {
    var _this = this;

    // context schema to be pass to Armis
    var options = arguments.length >= 1 ? arguments[0] : null;

    // the string value requesting what type of format to return the data
    var format = arguments.length > 1 ? arguments[1] : null;

    // the time of how long to persist Armis context
    var time = arguments.length > 2 || arguments.length === 2 && Number.isInteger(arguments[1]) ? arguments[1] : null;

    // set observables for streaming out data
    var pos$ = new _rxjs2.default.ReplaySubject(1);

    // init Language class for processing the text
    var lang = new _processSpeech2.default(pos$);

    // done method fires when guesses have been determine and armis has finish processing request
    var done = function done() {};

    /**
     * Retrieve a given context
     *
     * @param {any} string
     * @returns
     *
     * @memberOf Armis
     */
    this.getContext = function (string) {
        return lang.getContext(string);
    };

    /**
     * Add a given context
     *
     * @param {any} string
     * @param {any} tags
     *
     * @memberOf Armis
     */
    this.addContext = function (obj) {
        try {
            // handle context property
            if (typeof obj.context !== 'string') {
                throw new Error('context key value must be a string');
            }

            // handle tags property
            if (obj && obj.hasOwnProperty('context')) {
                var _obj = obj;

                if (!obj.hasOwnProperty('tags')) {
                    _obj = Object.assign({}, obj, { tags: [] });
                } else if (obj.hasOwnProperty('tags') && !Array.isArray(obj.tags)) {
                    throw new Error('tags must be a array of strings');
                }

                lang.setContext(_obj);
            } else {
                throw new Error('context object not correct');
            }

            // handle sub context property
            if (obj && obj.hasOwnProperty('sub_context')) {
                if (!Array.isArray(obj.sub_context)) {
                    throw new Error('sub context must be a array of objects');
                }
            }
        } catch (e) {
            console.log(e);
        }
    };

    /**
     * clear all context
     *
     * @param {any} str
     * @returns
     *
     * @memberOf Armis
     */
    this.removeContext = function (context) {
        lang.removeContext(context);
    };

    /**
     * Set a context with callback method
     *
     * @param {any} name
     * @param {any} func
     */
    this.context = function (name, func) {
        try {
            if (name && func) {
                lang.contextFuncs.push({
                    name: name,
                    func: func
                });
            } else {
                throw new Error('context missing params');
            }
        } catch (e) {
            console.log(e);
        }
    };

    /**
     * subscribes to the guess
     *
     * @param {any} event
     * @param {any} func
     */
    this.on = function (event, func) {
        pos$.subscribe(function (res) {
            if (event === 'guesses') {
                func(res, done);
            }
        }, function (err) {
            if (event === 'error') {
                func(err, done);
            }
        });
    };

    /**
     * extends armis memory parameters
     *
     * @param {any} name
     * @param {any} func
     */
    this.extend = function (name, func) {
        lang.extends.push({
            name: name,
            func: func
        });
    };

    /**
     * try to create a actionable command
     *
     * @param {any} str
     * @returns
     *
     * @memberOf Armis
     */
    this.guess = function (str, cb) {
        // attach callback to done method
        done = cb;

        // begin trying to guess the actionable command
        lang.process(Sugar.String.words(str));
    };

    /**
     * TODO: push action functionality
     *
     * @param {any} key
     * @param {any} actions
     */
    this.crud = function (key, actions) {};

    /**
     * destroy all context and subscriptions
     *
     * @param {any} str
     * @returns
     *
     * @memberOf Armis
     */
    this.destroy = function () {
        lang.clearContext();
        pos$.unsubscribe();
    };

    /**
     * Load all context options
     *
     * @param {any} options
     */
    var loadOption = function loadOption(_options_) {
        try {
            if (Array.isArray(_options_)) {
                _options_.forEach(function (obj) {
                    if (obj.hasOwnProperty('context')) {
                        _this.addContext(obj);
                    } else {
                        if (!obj.hasOwnProperty('context')) {
                            throw new Error('context key missing');
                        }
                    }
                });
            } else {
                throw new Error('options param must be an array of contextes.');
            }
        } catch (e) {
            console.log(e); // pass exception object to err handler
        }
    };

    /****************************************************************
     * Run setup on Armis instantiation
     ****************************************************************/

    // setup context options for initial load from pass context or path to context file
    if (arguments.length >= 1 && typeof arguments[0] === 'string') {
        var path = arguments[0];
        var regr = /(^\/)+/ig;

        if (arguments[0].includes('../') && arguments[0].includes('./')) {
            path = __dirname + '/' + arguments[0].replace('../', '');
        } else if (regr.test(arguments[0])) {
            path = __dirname + '/' + arguments[0].substring(1, arguments[0].length);
        }

        if (!arguments[0].match('.json')) {
            path = path + '.json';
        }

        jsonfile.readFile(path, function (err, obj) {
            loadOption(obj);
        });
    } else if (options) {
        loadOption(options);
    }

    // set the format if any
    if (format === 'values-and-pos' || format === 'all') {
        lang.format = format;
    }

    // set the time for context to persist
    if (Number.isInteger(time)) {
        lang.contextTime = time * 1000;
    }
};