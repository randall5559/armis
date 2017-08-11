#! /usr/bin/env node
'use strict';

const path = require('path');

// import Sugar to do some cool tricks on memories
require('sugar/polyfills/es6');
const Sugar = require('sugar');

// import json reader
const jsonfile = require('jsonfile')

// third parties libraries
import Rx from 'rxjs';

// classes
import Language from './controllers/process-speech';


module.exports = function(){

    // context schema to be pass to Armis
    var options = (arguments.length >= 1) ? arguments[0] : null;

    // the string value requesting what type of format to return the data
    var format = (arguments.length > 1) ? arguments[1] : null;

    // the time of how long to persist Armis context
    var time = (arguments.length > 2 || arguments.length === 2 && Number.isInteger(arguments[1])) ?
        arguments[1] : null;

    // set observables for streaming out data
    var pos$ = new Rx.ReplaySubject(1);

    // init Language class for processing the text
    var lang = new Language(pos$);

    // done method fires when guesses have been determine and armis has finish processing request
    var done = () => {};


    /**
     * Retrieve a given context
     *
     * @param {any} string
     * @returns
     *
     * @memberOf Armis
     */
    this.getContext = function(string) {
        return lang.getContext(string);
    }


    /**
     * Add a given context
     *
     * @param {any} string
     * @param {any} tags
     *
     * @memberOf Armis
     */
    this.addContext = (obj) => {
        try {
            // handle context property
            if (typeof obj.context !== 'string') {
                throw new Error('context key value must be a string');
            }

            // handle tags property
            if (obj && obj.hasOwnProperty('context')) {
                let _obj = obj;

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
    }


    /**
     * clear all context
     *
     * @param {any} str
     * @returns
     *
     * @memberOf Armis
     */
    this.removeContext = (context) => {
        lang.removeContext(context);
    }


    /**
     * Set a context with callback method
     *
     * @param {any} name
     * @param {any} func
     */
    this.context = (name, func) => {
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
    }


    /**
     * subscribes to the guess
     *
     * @param {any} event
     * @param {any} func
     */
    this.on = (event, func) => {
        pos$
        .subscribe(
            res => {
                if (event === 'guesses') {
                    func(res, done);
                }
            },
            err => {
                if (event === 'error') {
                    func(err, done);
                }
            }
        );
    }


    /**
     * extends armis memory parameters
     *
     * @param {any} name
     * @param {any} func
     */
    this.extend = (name, func) =>  {
        lang.extends.push({
            name: name,
            func: func
        });
    }


    /**
     * try to create a actionable command
     *
     * @param {any} str
     * @returns
     *
     * @memberOf Armis
     */
    this.guess = (str, cb) => {
        // attach callback to done method
        done = cb;

        // begin trying to guess the actionable command
        lang.process(Sugar.String.words(str));
    }


    /**
     * TODO: push action functionality
     *
     * @param {any} key
     * @param {any} actions
     */
    this.crud = (key, actions) => {

    }


    /**
     * destroy all context and subscriptions
     *
     * @param {any} str
     * @returns
     *
     * @memberOf Armis
     */
    this.destroy = () => {
        lang.clearContext();
        pos$.unsubscribe();
    }


    /**
     * Load all context options
     *
     * @param {any} options
     */
    var loadOption = (_options_) => {
        try {
            if (Array.isArray(_options_)) {
                _options_.forEach(obj => {
                    if (obj.hasOwnProperty('context')) {
                        this.addContext(obj);
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
    }


    /****************************************************************
     * Run setup on Armis instantiation
     ****************************************************************/

    // setup context options for initial load from pass context or path to context file
    if (arguments.length >= 1 && typeof arguments[0] === 'string') {
        let _path = path.resolve(arguments[0]);

        console.log(path.resolve(arguments[0]));

        if (!arguments[0].match('.json')) {
            _path = _path + '.json';
        }

        jsonfile.readFile(_path, function(err, obj) {
            loadOption(obj);
        });
    } else if (options) {
       loadOption(options)
    }

    // set the format if any
    if (format === 'values-and-pos' || format === 'all') {
        lang.format = format;
    }

    // set the time for context to persist
    if (Number.isInteger(time)) {
        lang.contextTime = (time * 1000);
    }
}
