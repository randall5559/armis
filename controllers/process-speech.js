'use strict';

// utilities

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _urlExt = require('../assets/url-ext.json');

var _urlExt2 = _interopRequireDefault(_urlExt);

var _actions = require('../assets/actions.json');

var _actions2 = _interopRequireDefault(_actions);

var _times = require('../assets/times.json');

var _times2 = _interopRequireDefault(_times);

var _state = require('../assets/state.json');

var _state2 = _interopRequireDefault(_state);

var _responses2 = require('../assets/responses.json');

var _responses3 = _interopRequireDefault(_responses2);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _knwl = require('knwl.js');

var _knwl2 = _interopRequireDefault(_knwl);

var _speakeasyNlp = require('speakeasy-nlp');

var _speakeasyNlp2 = _interopRequireDefault(_speakeasyNlp);

var _nlp_compromise = require('nlp_compromise');

var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);

var _compromise = require('compromise');

var _compromise2 = _interopRequireDefault(_compromise);

var _pos4 = require('pos');

var _pos5 = _interopRequireDefault(_pos4);

var _stemPorter = require('stem-porter');

var _stemPorter2 = _interopRequireDefault(_stemPorter);

var _dbpediaSpotlight = require('dbpedia-spotlight');

var _dbpediaSpotlight2 = _interopRequireDefault(_dbpediaSpotlight);

var _sentiment = require('sentiment');

var _sentiment2 = _interopRequireDefault(_sentiment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var isOnline = require('is-online');

//import Sugar to do some cool tricks on memories
require('sugar/polyfills/es6');
var Sugar = require('sugar');

//import json file(s)


// nlp modules

// import natural from 'natural';

// import synonyms from 'find-synonyms';

//constants
var SYSTEM_NAME = "armis";

var Language = function () {

    /**
     * Creates an instance of Language.
     *
     * @memberOf Language
     */
    function Language(obs$) {
        _classCallCheck(this, Language);

        // final main object
        this.finalObject = [];

        // main context persist the context across guesses
        this.mainContext = '';

        // main crud persist the crud across guesses
        this.mainCrud = '';

        // the time Armis will persist context in milliseconds
        this.contextTime = 10000;

        // clear the current context after the contextTime runs out
        this.clearMainContext = null;

        // context holder for objects with tags
        this.contextes = [];

        // context holder for objects with callback methods
        this.contextFuncs = [];

        // armis default properties
        this.baseProperties = ['date', 'time', 'phone', 'email', 'link', 'file', 'directory', 'number', 'people'];

        // extend armis memory params (currently: email, phone, link, date, time, file, directory, number)
        this.extends = [];

        // holds the number of queries/guesses to be sent to developer
        this.guesses = [];

        // the current guess be process index
        this.guessIndex = 0;

        // locks up a guess process until completed
        this.processStarted = false;

        // hold the orignal unmutated string of text for a guess process
        this.originalSpeech = '';

        // holds the properties needs to complete match context for a specific query
        this.properties = [];

        // give details to if mutilple guesses should be connected meaning,
        // run one after the other only if the one preceding it passes
        // or run them separately
        this.run = '';

        // the format of the data/results to be return
        this.format = 'values';

        // by default cli speech works without wifi
        this.hasWifi = false;

        // stream out an observable of part of speech objects
        this.tokens$ = obs$;

        isOnline().then(function (online) {
            //this.hasWifi = online;
            //=> true
        });
    }

    /**
     * Trigger a time of how long Armis will persist a context
     *
     * @memberof Language
     */


    _createClass(Language, [{
        key: 'timeContext',
        value: function timeContext() {
            var _this = this;

            // reset and reset context timer
            if (this.clearMainContext) {
                clearTimeout(this.clearMainContext);
            }

            this.clearMainContext = setTimeout(function () {
                _this.clearContext();
            }, this.contextTime);
        }

        /**
         * Process a token sentence
         *
         * @param {any} _tokens
         *
         * @memberOf Language
         */

    }, {
        key: 'process',
        value: function process(args) {
            var _this2 = this;

            // reset and reset context timer
            this.timeContext();

            if (!this.processStarted) {
                // lower case all tokens
                var _tokens = args.map(function (token) {
                    return token.toString().toLowerCase();
                });

                this.processStarted = true;
                this.originalSpeech = _tokens.join(' ');

                // remove armis if the token index is anywhere except 0 index
                Sugar.Array.remove(_tokens, SYSTEM_NAME);

                // call methods sequentially
                [this.uncontract, this.tagWords, this.segmentize].reduce(function (acc, method) {
                    return method(acc, _this2, _tokens);
                }, _tokens);
            } else if (this.properties.length > 0) {
                // get the last object in the finalObject array
                var _final = this.finalObject[this.finalObject.length - 1];

                // handle custom added properties with extend
                var extendObj = this.extends.reduce(function (acc, obj) {
                    acc[obj.name] = obj.func(args);

                    return acc;
                }, {});

                this.guesses = this.guesses.reduce(function (acc, guess, index) {
                    _this2.properties.forEach(function (property) {
                        if (Object.keys(guess).includes(property)) {
                            var objProp = {};
                            objProp[property] = extendObj[property];
                            guess = Object.assign({}, guess, objProp);
                        }
                    });

                    acc.push(guess);

                    return acc;
                }, []);

                this.final(Object.assign({}, _final.obj, { extends: extendObj }), this, _final.tokens);
            }
        }

        /**
         * process a guess break up strings one at a time
         *
         * @param {any} _obj
         * @param {any} _self
         * @param {any} _tokens
         *
         * @memberOf Language
         */

    }, {
        key: 'doGuessProcess',
        value: function doGuessProcess(_obj, _self, _tokens) {
            _self.guessIndex++;

            // call methods sequentially
            [this.tagWords, this.isQuestion, this.pullTextParams, this.getSubject, this.getVerbs, this.getObject, this.establishContext, this.getTense, this.getInterjection, this.final].reduce(function (acc, method) {
                return method(acc, _self, _tokens);
            }, _obj);
        }

        /**
         * get the specify context
         *
         * @param {any} string
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getContext',
        value: function getContext(string) {
            return this.contextes.reduce(function (acc, obj) {
                if (obj.context === string) {
                    acc = obj;
                }

                return acc;
            }, {});
        }

        /**
         * set context for mapping references
         *
         * @param {any} obj
         *
         * @memberOf Language
         */

    }, {
        key: 'setContext',
        value: function setContext(obj) {
            //////////////////////////////////////////////////////////////////////////////////////////////////////
            // COMMENTED OUT BELOW CODE FOR NOW AS STEMMING NOT CONSISTENCE ACROSS DIFFERENT FORMS OF TOKENS
            //
            //  // stem all tags
            //  obj.tags = obj.tags.map(tag => natural.PorterStemmer.stem(tag));
            //  if (obj.hasOwnProperty('sub_context')) {
            //         obj.sub_context = obj.sub_context.map(sub_obj => {
            //             sub_obj.tags = sub_obj.tags.map(_tag => natural.PorterStemmer.stem(_tag));
            //          return sub_obj
            //      });
            //  }
            //////////////////////////////////////////////////////////////////////////////////////////////////////

            // see if context already exist, if so store index
            var index = this.contextes.reduce(function (acc, _obj, index) {
                if (_obj.context === obj.context) {
                    acc = index;
                }

                return acc;
            }, null);

            // set context if exist by index or push new object with tags to contextes array
            if (index) {
                this.contextes[index].tags.concat(obj.tags);

                if (obj.hasOwnProperty('sub_context') && obj.sub_context.length > 0) {
                    this.contextes[index].sub_context.forEach(function (_obj) {
                        obj.sub_context.forEach(function (sub_obj) {
                            if (_obj.context === sub_obj.context) {
                                _obj.tags.concat(sub_obj.tags);
                            }
                        });
                    });
                }
            } else {
                // push context and sub context to approriate tags
                obj.tags.push(obj.context);

                if (obj.hasOwnProperty('sub_context')) {
                    obj.sub_context.forEach(function (_cont) {
                        try {
                            _cont.tags.forEach(function (_tag) {
                                if (obj.tags.includes(_tag)) {
                                    throw new Error('Armis Error: can\'t have tag \'' + _tag + '\' in main and sub context schema!');
                                }
                            });

                            obj.tags.push(_cont.context);
                            _cont.tags.push(_cont.context);
                        } catch (e) {
                            if (e) {
                                console.log(e);
                            } else {
                                new Error('Armis Error: couldn\'t add sub context tags');
                            }
                        }
                    });
                }

                this.contextes.push(obj);
            }
        }

        /**
         * Remove a context from the context schema
         *
         * @param {any} _context_
         *
         * @memberOf Language
         */

    }, {
        key: 'removeContext',
        value: function removeContext(_context_) {
            this.contextes = this.contextes.reduce(function (acc, _cont) {
                if (_context_ !== _cont.context) {
                    acc.push(_cont);
                }

                return acc;
            }, []);
        }

        /**
         * clear all the set contextes in memory
         *
         * @memberOf Language
         */

    }, {
        key: 'clearContext',
        value: function clearContext() {
            this.mainContext = '';
            this.mainCrud = '';
            this.resetGuesses(this);
        }

        /*****************************************
         * chained private methods
         *****************************************/

        /**
         * Uncontract contractions into their root form
         * and removed special character titles
         *
         * @param {any} tokens
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'uncontract',
        value: function uncontract(tokens) {
            var _tokens_ = tokens.reduce(function (_tokens, token, index, collection) {
                var hasSpecialChar = /[\W_]+/g.test(token);

                // if (index === 0) {
                //     _tokens.push(SYSTEM_NAME);
                // }

                var _token = token;

                [["let's", "let us"], ["let\'s", "let us"], ["n't", " not"], ["n\'t", " not"], ["'re", " are"], ["'d", " should", " would", " had"], ["'ll", " will"], ["'s", " is", " has"], ["i'm", "i am"]].forEach(function (contraction) {
                    if (_token.includes(contraction[0])) {
                        _token = token.replace(contraction[0], contraction[1]);
                        _token = Sugar.String.words(_token);
                        _tokens.push(_token[0]);
                        _tokens.push(_token[1]);
                    }
                });

                // only push tokens that don't have special characters in them
                //if (!hasSpecialChar) {
                if (!Sugar.Object.isArray(_token)) {
                    _tokens.push(_token);
                }

                //}

                return _tokens;
            }, []);

            return { tokens: _tokens_ };
        }

        /**
         * Tag the words with fasttag part of speech tagger implementation
         *
         * @param {any} str
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'tagWords',
        value: function tagWords(_obj) {
            var str = typeof _obj === 'string' ? _obj : _obj.tokens.join(' ');
            var words = new _pos5.default.Lexer().lex(str);
            var tagger = new _pos5.default.Tagger();
            var taggedWords = tagger.tag(words);

            // remove or other punction
            if (str) {
                if (taggedWords[taggedWords.length - 1][0] === "." || taggedWords[taggedWords.length - 1][0] === "?" || taggedWords[taggedWords.length - 1][0] === "!") taggedWords.pop();
            }

            /*
            * fix tags like "I" should be PRP but it's NN and "Like" and
            * "Love" should be VB not IN and NN with the "pos" node_module
            *  also will add other words over time
            */
            [["i", "PRP"], ["like", "VB"], ["love", "VB"], ["hope", "VB"], ["plan", "VB"], ["change", "VB"], ["review", "VB"], ["move", "VB"], ["use", "VB"], ["aways", "RB"], ["away", "RB"], ["cherry", "NN"], ["set", "VB"], ["switch", "VB"], ["need", "VB"], ["shut", "VB"], ["removed", "VB"], ["wash", "VB"], ["display", "VB"], ["show", "VB"]].forEach(function (fix) {
                taggedWords.forEach(function (tag) {
                    if (tag[0] === fix[0]) {
                        tag[1] = fix[1];
                    }
                });
            });

            return Object.assign({}, _obj, { tags: taggedWords, speech: str });
        }

        /**
         * Segmentize take sentences and breaks them up depending on contend or other
         * TODO:
         * split speech up into separate sentences if "and, or, but" is present
         */

    }, {
        key: 'segmentize',
        value: function segmentize(_obj, _self, _tokens) {
            // comment out these tags for now as starting tags are needed
            var patterns = ["MD", "VB", "VBG", "VBD", "VBN", "VBP", "VBZ" /*"RBR","RBS","RP","RB"*/];
            var separateWords = ['and', 'but', 'however', 'otherwise', 'plus'];
            var joiningWords = ['because', 'unless', 'then', 'until', 'if'];
            var countToBreakContext = 0;
            var lockContext = false;
            var lockAction = false;
            var contObj = {
                context: null,
                sub_context: null,
                tokens: []
            };

            var clearContObj = function clearContObj() {
                countToBreakContext = 1;
                lockContext = false;
                lockAction = false;
                contObj = {
                    context: null,
                    sub_context: null,
                    tokens: []
                };
            };

            var tryContextBreak = function tryContextBreak(_context_, _subContext_) {
                if (!lockContext) {
                    contObj.context = !contObj.context ? _context_ : contObj.context;
                    contObj.sub_context = !contObj.sub_context ? _subContext_ : contObj.sub_context;
                    lockContext = true;

                    return true;
                } else if (_context_ !== contObj.context && _subContext_ !== contObj._sub_cont && lockAction) {
                    contObj.context = !contObj.context ? _context_ : contObj.context;
                    contObj.sub_context = !contObj.sub_context ? _subContext_ : contObj.sub_context;
                    lockContext = true;

                    return true;
                }
            };

            // break context up
            _self.guesses = _obj.tags.reduce(function (acc, tag, index) {
                var token = tag[0];
                var pos = tag[1];
                var trybreakIt = function trybreakIt() {
                    countToBreakContext++;
                    if (countToBreakContext === 3 && index < _obj.tags.length - 1) {
                        acc.push(contObj);
                        clearContObj();
                    }
                };

                _self.contextes.forEach(function (_cont) {
                    var shouldIgnore = _cont.hasOwnProperty('ignores') ? _tokens.filter(function (token) {
                        return _cont.ignores.includes(token);
                    }).length > 0 : false;

                    if (!shouldIgnore) {
                        if (_cont.hasOwnProperty('sub_context')) {
                            _cont.sub_context.forEach(function (_sub_cont) {
                                if (index > 1 && _sub_cont.tags.includes(_obj.tags[index - 2][0] + '-' + _obj.tags[index - 1][0] + '-' + token) || index > 0 && _sub_cont.tags.includes(_obj.tags[index - 1][0] + '-' + token) || _sub_cont.tags.includes(token)) {
                                    trybreakIt();
                                    tryContextBreak(_cont.context, _sub_cont.context);
                                }
                            });
                        }

                        if (contObj.context === null && contObj.sub_context === null) {
                            if (index > 1 && _cont.tags.includes(_obj.tags[index - 2][0] + '-' + _obj.tags[index - 1][0] + '-' + token)) {
                                trybreakIt();
                                tryContextBreak(_cont.context, '');
                                // tryContextBreak(_cont.context, `${_obj.tags[index-2][0]} ${_obj.tags[index-1][0]} ${token}`);
                            } else if (index > 0 && _cont.tags.includes(_obj.tags[index - 1][0] + '-' + token)) {
                                trybreakIt();
                                tryContextBreak(_cont.context, '');
                                // tryContextBreak(_cont.context, `${_obj.tags[index-1][0]} ${token}`);
                            } else if (_cont.tags.includes(token)) {
                                trybreakIt();
                                tryContextBreak(_cont.context, '');
                                // tryContextBreak(_cont.context, token);
                            }
                        }
                    }
                });

                if (!lockAction && patterns.includes(pos)) {
                    trybreakIt();
                    lockAction = true;
                } else if (lockAction && lockContext && patterns.includes(pos)) {
                    trybreakIt();
                    lockAction = true;
                }

                contObj.tokens.push(token);

                if (index === _obj.tags.length - 1 && lockAction && lockContext) {
                    acc.push(contObj);
                    clearContObj();
                }

                if (joiningWords.includes(token) && index > 1) {
                    _self.run = 'join';
                } else if (separateWords.includes(token)) {
                    _self.run = 'individual';
                }

                return acc;
            }, []);

            // try with word breaks
            var testForBreakWord = function testForBreakWord(_startIndex, _endIndex, _run) {
                clearContObj();
                _self.run = _run;
                var hasAction = false;
                var _objSlice = _obj.tags.slice(_startIndex, _endIndex);

                return _objSlice.reduce(function (acc, _tag, index) {
                    var token = _tag[0];
                    var pos = _tag[1];

                    _self.contextes.forEach(function (_cont) {
                        var shouldIgnore = _cont.hasOwnProperty('ignores') ? _tokens.filter(function (token) {
                            return _cont.ignores.includes(token);
                        }).length > 0 : false;

                        if (!shouldIgnore) {
                            if (_cont.hasOwnProperty('sub_context')) {
                                _cont.sub_context.forEach(function (_sub_cont) {
                                    if (index > 1 && _sub_cont.tags.includes(_objSlice[index - 2][0] + '-' + _objSlice[index - 1][0] + '-' + token) || index > 0 && _sub_cont.tags.includes(_objSlice[index - 1][0] + '-' + token) || _sub_cont.tags.includes(token)) {
                                        tryContextBreak(_cont.context, _sub_cont.context);
                                    }
                                });
                            }

                            if (contObj.context === null && contObj.sub_context === null) {
                                if (index > 1 && _cont.tags.includes(_objSlice[index - 2][0] + '-' + _objSlice[index - 1][0] + '-' + token)) {
                                    tryContextBreak(_cont.context, _objSlice[index - 2][0] + ' ' + _objSlice[index - 1][0] + ' ' + token);
                                } else if (index > 0 && _cont.tags.includes(_objSlice[index - 1][0] + '-' + token)) {
                                    tryContextBreak(_cont.context, _objSlice[index - 1][0] + '-' + token);
                                } else if (_cont.tags.includes(token)) {
                                    tryContextBreak(_cont.context, token);
                                }
                            }
                        }
                    });

                    if (patterns.includes(pos)) {
                        hasAction = true;
                    }

                    contObj.tokens.push(token);

                    if (index === _objSlice.length - 1 /*&& hasAction*/) {
                            acc = contObj;
                        }

                    return acc;
                }, {});
            };

            // see if joining or separate exist in tokens
            var hasOneCanBreak = function hasOneCanBreak(__tokens__) {
                return __tokens__.reduce(function (acc, _token) {
                    if (joiningWords.includes(_token) || separateWords.includes(_token)) {
                        acc = true;
                    }

                    return acc;
                }, false);
            };

            if (_self.guesses.length === 0 || _self.guesses.length === 1 && hasOneCanBreak(_self.guesses[0].tokens)) {
                // try with word breaks
                _self.guesses = _obj.tags.reduce(function (acc, _tag, index) {
                    var token = _tag[0];
                    var pos = _tag[1];

                    var pushWords = function pushWords(_index_, _objTags_, _run_) {
                        var rightSide = testForBreakWord(0, _index_, _run_);
                        var leftSide = testForBreakWord(_index_ + 1, _objTags_.length, _run_);

                        if (Object.keys(rightSide).length > 0) {
                            acc.push(rightSide);
                        }

                        if (Object.keys(leftSide).length > 0) {
                            acc.push(leftSide);
                        }
                    };

                    if (separateWords.includes(token) && index > 1 && !joiningWords.includes(_obj.tags[index + 1][0])) {
                        pushWords(index, _obj.tags, 'individual');
                    } else if (joiningWords.includes(token) && index > 1) {
                        pushWords(index, _obj.tags, 'join');
                    }

                    return acc;
                }, []);

                if (_self.guesses.length === 1) {
                    _self.guesses[0].tokens = _obj.tokens;
                }
            } else {
                _self.run = 'individual';
            }

            // start creating guesses
            if (_self.guesses.length === 0) {
                contObj.tokens = _obj.tokens;
                _self.guesses.push(contObj);
            }

            _self.doGuessProcess(_self.guesses[0], _self, _self.guesses[0].tokens);
        }

        /**
        *
        *
        * @param {any} obj
        * @param {any} _self
        * @param {any} _tokens
        * @returns
        *
        * @memberOf Language
        */

    }, {
        key: 'isQuestion',
        value: function isQuestion(obj, _self, _tokens) {
            var isQuestion = false;
            var questionType = '';
            var startWords = ['did', 'do', 'would', 'should', 'are', 'is', 'has', 'can'];
            var whWords = ['who', 'where', 'when', 'why', 'what', 'which', 'how'];
            var notWords = ['do you', 'do we', 'do they', 'does she', 'does he', 'do i', 'do not you', 'do not we', 'do not they', 'do not she', 'do not he', 'do not i', 'is not you', 'is not we', 'is not they', 'is not she', 'is not he', 'is not i', 'is not there', 'are not you', 'are not we', 'are not they', 'are not she', 'are not he', 'are not i', 'are not there', 'are you', 'are we', 'are they', 'are there'];

            // wh- questions
            whWords.forEach(function (word) {
                if (_tokens.includes(word)) {
                    isQuestion = true;
                    questionType = 'wh';
                }
            });

            // - not - questions
            notWords.forEach(function (words) {
                if (obj.speech.match(words)) {
                    isQuestion = true;
                    questionType = 'tag';
                }
            });

            // start word questions
            startWords.forEach(function (word) {
                if (_tokens[0] === word) {
                    isQuestion = true;
                    questionType = 'yes_no';
                }

                // or type
                if (_tokens[0] === word && _tokens.includes('or')) {
                    questionType = 'alternative';
                }
            });

            return Object.assign({}, obj, { is_question: isQuestion, question_type: questionType });
        }

        /**
        * pull values phone, website, email
        *
        * @memberOf Language
        */

    }, {
        key: 'pullTextParams',
        value: function pullTextParams(obj, _self, _tokens) {
            var _obj = Object.assign({}, obj);
            var context = null;

            // check if there a word saying that relates to time
            var timeSaying = _self.getTimeFromSaying(_tokens.join(' '));
            var str = timeSaying.time ? timeSaying.time : _tokens.join(' ');
            _obj = Object.assign({}, _obj, { tense: timeSaying.tense });

            // use to pull phone, email, website, date, time
            var knwlInstance = new _knwl2.default('english');
            knwlInstance.init(str);

            // people
            var people = (0, _compromise2.default)(str).people().normalize().sort('frequency').unique().out('array');

            // places
            var places = (0, _compromise2.default)(str).places().sort('alpha').out('array');

            // pull a file from string if any
            var files = _tokens.reduce(function (acc, token) {
                var isFile = /(?:\.([^.]+))?$/i.exec(token)[1];
                var notEmail = /\w+@\w+\.\w+/g.test(token);
                var notLink = /[://]+/.test(token);

                if (isFile !== undefined && !notEmail && !notLink) {
                    if (!_urlExt2.default.includes(isFile)) {
                        acc.push(token);
                    }
                }

                return acc;
            }, []);

            // pull directories from string
            var dirs = _tokens.reduce(function (acc, token) {
                var isDir = /(\w|\W)*\/\w+/i.test(token);
                var isFile = /(?:\.([^.]+))?$/i.exec(token)[1];

                if (isDir && !_urlExt2.default.includes(isFile)) {
                    acc.push(token);
                }

                return acc;
            }, []);

            // pull the phone numbers
            var phones = knwlInstance.get('phones').reduce(function (acc, phone) {
                acc.push(phone.phone);
                context = 'phone';
                return acc;
            }, []);

            // pull the web links
            var links = knwlInstance.get('links').reduce(function (acc, link) {
                acc.push(link.link);
                context = 'link';
                return acc;
            }, []);

            // pull the emails
            var emails = knwlInstance.get('emails').reduce(function (acc, email) {
                acc.push(email.address);
                context = 'email';
                return acc;
            }, []);

            // pull the dates
            var dates = knwlInstance.get('dates').reduce(function (acc, date) {
                var month = date.month === 'unknown' ? new Date().getMonth() : date.month;
                var day = date.day === 'unknown' ? new Date().getDay() : date.day;
                var year = date.year === 'unknown' ? new Date().getFullYear() : date.year;

                var _date = month + '-' + day + '-' + year;
                acc.push(_date);
                return acc;
            }, []);

            // pull the times
            var timesKnwl = knwlInstance.get('times').reduce(function (acc, time) {
                if (time.daynight === 'Unknown') {
                    time.daynight = _tokens.reduce(function (acc, token) {
                        var am = /\d+(am)/g;
                        var pm = /\d+(pm)/g;

                        if (am.test(token)) {
                            acc = 'am';
                        } else if (pm.test(token)) {
                            acc = 'pm';
                        }

                        return acc;
                    }, 'Unknown');
                }

                var _time = time.daynight === 'Unknown' ? time.hour + ':' + time.minute : time.hour + ':' + time.minute + ' ' + time.daynight;
                acc.push(_time);
                return acc;
            }, []);

            if (timesKnwl.length === 0 && dates.length > 0) {
                timesKnwl.push((0, _moment2.default)().format("h:mm a"));
            }

            // pull the numbers out if any
            var numbers = (0, _compromise2.default)(str).values().toNumber().out('array');

            // handle custom added properties with extend
            var extendObj = _self.extends.reduce(function (acc, obj) {
                acc[obj.name] = obj.func(_tokens);

                return acc;
            }, {});

            // provide an initial context if any
            var contextObj = context ? { context: context } : {};

            return Object.assign({}, _obj, contextObj, {
                person: people,
                places: places,
                phones: phones,
                links: links,
                emails: emails,
                dates: dates,
                times: timesKnwl,
                numbers: numbers,
                files: files,
                directories: dirs,
                extends: extendObj
            });
        }

        /**
         * Get the subject of the passed tokens
         *
         * @param {any} obj
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getSubject',
        value: function getSubject(obj) {
            var _obj = Object.assign({}, obj);
            var sub = [];
            var patterns = ["NN", "NNP", "NNPS", "NNS", "VBG", "PRP", "PRP$", "JJ", "JJR", "JJS", "WDT", "WP", "WP$", "WRB", "CD"];
            var oddies = ["DT", "CC", "IN", "TO"];
            var firstVerb = ["VB", "VBG", "VBD", "VBN", "VBP", "VBZ"];
            var _lockSub = false;
            var deepTag = Sugar.Object.get(obj, 'tags[0][1]');

            if (firstVerb && firstVerb.includes(deepTag)) {
                return Object.assign({}, _obj, {
                    verb_at_start: true,
                    subject: SYSTEM_NAME,
                    sub_end_index: 0
                });
            }

            sub = _obj.tags.reduce(function (acc, tag, index) {
                if (!_lockSub) {
                    var token = tag[0];
                    var _pos2 = tag[1];

                    if (_pos2 === 'VBG' && index === 0) {
                        acc.push(token);
                    } else if (patterns.includes(_pos2) && _pos2 !== 'VBG') {
                        acc.push(token);
                    } else if (oddies.includes(_pos2)) {
                        acc.push(token);
                    }

                    if (firstVerb.includes(_pos2)) {
                        _lockSub = true;
                    }
                }

                return acc;
            }, []);

            if (sub.length === 0) {
                sub.push(SYSTEM_NAME);
            }

            return Object.assign({}, _obj, {
                subject: sub.join(' '),
                sub_end_index: sub.length
            });
        }

        /**
         * Get verbs of the passed tokens
         * Get the crud of the tokens if any
         * Get the state of the tokens if any
         *
         * @param {any} obj
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getVerbs',
        value: function getVerbs(obj, _self) {
            var _obj = Object.assign({}, obj);
            var verbs = [];
            var verbIsAtStart = _obj.hasOwnProperty("verb_at_start") ? _obj.verb_at_start : false;
            var verbStartPos = _obj.sub_end_index;
            var verbEndPos = null;
            var _lockVerbs = false;
            var firstObject = ["NN", "NNP", "NNPS", "NNS", "VBG", "PRP", "PRP$", "JJ", "JJR", "JJS", "WDT", "WP", "WP$", "WRB", "CD"];
            var patterns = ["MD", "VB", "VBG", "VBD", "VBN", "VBP", "VBZ", "RBR", "RBS", "RP", "RB"];
            var notFirstValue = ["RBR", "RBS", "RP", "RB"];
            var oddies = ["IN", "TO"]; //"JJ","JJR","JJS"

            if (verbStartPos || verbIsAtStart) {
                verbs = _obj.tags.slice(verbStartPos, _obj.tags.length).reduce(function (acc, tag, index) {
                    if (!_lockVerbs) {
                        var token = tag[0];
                        var _pos3 = tag[1];

                        if (patterns.includes(_pos3) && index > 0) {
                            acc.push(token);
                        } else if (!notFirstValue.includes(_pos3) && index === 0) {
                            acc.push(token);
                        } else if (oddies.includes(_pos3)) {
                            acc.push(token);
                            _lockVerbs = true;
                        }

                        if (firstObject.includes(_pos3)) {
                            _lockVerbs = true;
                        }
                    }

                    return acc;
                }, []);
            }

            var actionableState = null;
            var crud = [];

            // do combined verbs/actions to see if CRUD action exist
            Object.keys(_actions2.default).forEach(function (key) {
                var wordJoined = verbs.join('-');
                var rootWord = (0, _compromise2.default)(wordJoined).out('root');

                if (_actions2.default[key].includes(wordJoined)) {
                    crud.push(key);
                } else if (_actions2.default[key].includes(rootWord)) {
                    crud.push(key);
                }

                // set the state
                if (key === 'update') {
                    var index = _actions2.default[key].indexOf(wordJoined);
                    if (index > -1) {
                        actionableState = _state2.default[_actions2.default[key][index]];
                    }
                }
            });

            // if it's a question then crud is read
            if (_obj.is_question) {
                crud.length = 0;
                crud.push('read');
            }

            // do single verbs/actions to see if CRUD action exist
            if (crud.length === 0) {
                crud = verbs.reduce(function (acc, verb) {
                    Object.keys(_actions2.default).forEach(function (key) {
                        var rootWord = (0, _compromise2.default)(verb).out('root');

                        if (_actions2.default[key].includes(verb)) {
                            acc.push(key);
                        } else if (_actions2.default[key].includes(rootWord)) {
                            crud.push(key);
                        }

                        // set the state
                        if (key === 'update') {
                            var index = _actions2.default[key].indexOf(verb);
                            if (index > -1) {
                                actionableState = _state2.default[_actions2.default[key][index]];
                            }
                        }
                    });

                    return acc;
                }, []);
            }

            // try on subject if not action or crud is found
            if (crud.length === 0) {
                crud = _obj.subject.split(' ').reduce(function (acc, sub) {
                    Object.keys(_actions2.default).forEach(function (key) {
                        var rootWord = (0, _compromise2.default)(sub).out('root');

                        if (_actions2.default[key].includes(sub)) {
                            acc.push(key);
                            verbs = [sub].concat(verbs);
                        } else if (_actions2.default[key].includes(rootWord)) {
                            acc.push(key);
                            verbs = [sub].concat(verbs);
                        }

                        // set the state
                        if (key === 'update') {
                            var index = _actions2.default[key].indexOf(sub);
                            if (index > -1) {
                                actionableState = _state2.default[_actions2.default[key][index]];
                            }
                        }
                    });

                    return acc;
                }, []);
            }

            // add state to obj if any
            if (actionableState !== null) {
                var expr = /(don't|not|donot)+/ig;

                if (expr.test(_obj.subject + verbs.join(' '))) {
                    actionableState = null;
                }

                if (crud.length > 0 && crud[0] === 'read') {
                    _obj = Object.assign({}, _obj, { state: null });
                } else {
                    _obj = Object.assign({}, _obj, { state: actionableState });
                }
            }

            return Object.assign({}, _obj, {
                verbs: verbs.join(' '),
                crud: crud.length > 0 ? crud[0] : '',
                end_index: verbStartPos + verbs.length
            });
        }

        /**
         * Get the object of the passed tokens
         *
         * @param {any} obj
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getObject',
        value: function getObject(obj) {
            var _obj = Object.assign({}, obj);
            var objItem = [];
            var crud = obj.crud === '' ? [] : [obj.crud];
            var objStartIndex = _obj.end_index;
            var patterns = ["DT", "NN", "NNP", "NNPS", "NNS", "VBG", "PRP", "PRP$", "JJ", "JJR", "JJS"];
            var patternTwo = ["NN", "NNP", "NNPS", "NNS", "PRP", "PRP$", "JJ", "JJR", "JJS", "DT", "CC", "IN", "CD", "TO", "VB", "VBG", "VBD", "VBN", "VBP", "VBZ", "RBR", "RBS", "RP", "RB"];

            if (objStartIndex) {
                objItem = _obj.tags.slice(objStartIndex, _obj.tags.length).reduce(function (acc, tag, index) {
                    var token = tag[0];
                    var pos = tag[1];

                    if (objStartIndex + index > objStartIndex) {
                        if (patternTwo.includes(pos)) {
                            acc.push(token);
                        }
                    }

                    if (patterns.includes(pos) && objStartIndex === objStartIndex + index) {
                        acc.push(token);
                    }

                    return acc;
                }, []);
            }

            var actionableState = null;

            if (crud.length === 0) {
                crud = objItem.reduce(function (acc, objItem) {
                    Object.keys(_actions2.default).forEach(function (key) {
                        if (_actions2.default[key].includes(objItem)) {
                            acc.push(key);
                        }

                        // set the state
                        if (key === 'update') {
                            var index = _actions2.default[key].indexOf(objItem);
                            if (index > -1) {
                                actionableState = _state2.default[_actions2.default[key][index]];
                            }
                        }
                    });

                    return acc;
                }, []);
            }

            // add state to obj if any
            if (actionableState !== null) {
                if (crud.length > 0 && crud[0] === 'read') {
                    _obj = Object.assign({}, _obj, { state: null });
                } else {
                    _obj = Object.assign({}, _obj, { state: actionableState });
                }
            }

            return Object.assign({}, _obj, {
                object: objItem.join(' '),
                crud: crud.length > 0 ? crud[0] : ''
            });
        }

        /**
         * Set the context of the conversation with armis and user ( this is important )
         *
         * @memberOf Language
         */

    }, {
        key: 'establishContext',
        value: function establishContext(obj, _self) {
            var tokens = _self.tagObj(obj.subject).join(' ');
            tokens = tokens ? tokens : _self.tagObj(obj.object).join(' ');

            if (tokens && !obj.hasOwnProperty('context')) {
                obj.context = tokens;
            }

            return obj;
        }

        /**
         * Get the sentence tense
         *
         * @param {any} obj
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getTense',
        value: function getTense(obj) {
            var _obj = Object.assign({}, obj);
            var hasPastTag = false;
            var pastPattern = ["VBD", "VBN"];
            var futurePattern = ["MD"];
            var tense = "present";

            if (_obj.tense === null) {
                _obj.tags.forEach(function (tag) {
                    var pos = tag[1];

                    if (pastPattern.includes(pos)) {
                        tense = "past";
                        hasPastTag = true;
                    } else if (futurePattern.includes(pos)) {
                        tense = "future";
                    }
                });
            } else {
                if (_obj.tense === 'past') {
                    tense = "past";
                    hasPastTag = true;
                } else {
                    tense = "future";
                }
            }

            return Object.assign({}, _obj, {
                tense: hasPastTag ? "past" : tense,
                crud: hasPastTag ? 'read' : _obj.crud
            });
        }

        /**
         * Pull interjections (hello, oops, huh) from text
         *
         * @param {any} obj
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getInterjection',
        value: function getInterjection(obj) {
            var _obj = Object.assign({}, obj);
            var patterns = ['UH'];
            var interjection = [];

            interjection = _obj.tags.reduce(function (acc, tag) {
                if (patterns.includes(tag[1])) {
                    acc.push(tag[0]);
                }
                return acc;
            }, []);

            return Object.assign({}, _obj, {
                interjection: interjection
            });
        }

        /**
         *
         *
         * @param {any} obj
         * @param {any} _self
         * @param {any} _tokens
         *
         * @memberOf Language
         */

    }, {
        key: 'final',
        value: function final(obj, _self, _tokens) {
            // persist in memory the final obj modified (verb, subject, actions, etc.)
            _self.finalObject.push({
                obj: obj,
                tokens: _tokens
            });

            var _obj = Object.assign({}, obj, { tokens: _tokens });

            if (_self.hasWifi && _tokens.length >= 3) {
                // call with wifi mode
                //call out to dbPedia module for wiki for types, main subjects, and definitions
                _dbpediaSpotlight2.default.annotate(_obj.speech, function (output) {
                    var dbPediaObj = output.hasOwnProperty("response") && output.response.hasOwnProperty("Resources") ? _self.dbPediaParse(output) : { types: null, main_object: null };

                    var useMainObject = function useMainObject(object) {
                        var tags = _self.tagObj(object);
                        if (tags.length === 0) return false;else return true;
                    };

                    dbPediaObj.main_object = dbPediaObj.main_object && useMainObject(dbPediaObj.main_object) ? dbPediaObj.main_object : _obj.object;

                    var sentiment = _self.getSentiment(_obj.speech, _obj.subject);
                    var sentimentWords = sentiment.score !== "neutral" ? sentiment[sentiment.score].words : [];
                    var memory = _self.createMemoryObj(dbPediaObj, _obj, sentiment, sentimentWords);

                    // replace main_object with verb VBG if main_object and object are null
                    if (memory.main_object === undefined || memory.main_object === "") {
                        memory.main_object = _self.checkVerbForms(memory.action);
                    }

                    /**********************************************************
                     EXTRA INFO THAT'S HIDDEN FOR NOW. MAY USE IN FUTURE
                         let textBreakDown = {
                            subject_tagged : _self.tagWords(obj.subject),
                            ngram : _self.getNGrams(obj.speech, 2),
                            tags : obj.tags,
                            ddpedia : output,
                        };
                    ***********************************************************/

                    // send response or create another guess
                    if (_self.guesses.length > 0) {
                        _self.guesses[_self.guessIndex - 1] = _self.removeEmptyKeysSetContextAndProps(memory, _self, _obj.tokens, _obj);
                    }

                    if (_self.guessIndex === _self.guesses.length) {
                        var results = _self.missingProperties(_self);

                        if (results.length > 0) {
                            _self.tokens$.next({
                                status: 'uncomplete',
                                results: results,
                                run: _self.run,
                                speech: _self.originalSpeech,
                                timestamp: (0, _moment2.default)().valueOf()
                            });
                        } else {
                            _self.tokens$.next({
                                status: 'completed',
                                results: _self.guesses,
                                run: _self.run,
                                speech: _self.originalSpeech,
                                timestamp: (0, _moment2.default)().valueOf()
                            });
                            _self.resetGuesses(_self);
                        }
                    } else {
                        _self.doGuessProcess(_self.guesses[_self.guessIndex], _self, _self.guesses[_self.guessIndex].tokens);
                    }
                });
            } else {
                // offline call mode
                var sentiment = _self.getSentiment(_obj.speech, _obj.subject);
                var sentimentWords = sentiment.score !== "neutral" ? sentiment[sentiment.score].words : [];
                var memory = _self.createMemoryObj({ main_object: null, types: null }, _obj, sentiment, sentimentWords);
                var subject = _speakeasyNlp2.default.classify(_obj.speech).subject;

                memory.main_object = subject ? subject : _self.checkVerbForms(memory.action);

                // replace main_object with verb VBG if main_object and object are null
                if (memory.main_object === undefined) {
                    memory.main_object = '';
                }

                // send response or create another guess
                if (_self.guesses.length > 0) {
                    _self.guesses[_self.guessIndex - 1] = _self.removeEmptyKeysSetContextAndProps(memory, _self, _obj.tokens, _obj);
                }

                if (_self.guessIndex === _self.guesses.length) {
                    var results = _self.missingProperties(_self);

                    if (results.length > 0) {
                        _self.tokens$.next({
                            status: 'uncomplete',
                            results: results,
                            run: _self.run,
                            speech: _self.originalSpeech,
                            timestamp: (0, _moment2.default)().valueOf()
                        });
                    } else {
                        _self.tokens$.next({
                            status: 'completed',
                            results: _self.guesses,
                            run: _self.run,
                            speech: _self.originalSpeech,
                            timestamp: (0, _moment2.default)().valueOf()
                        });
                        _self.resetGuesses(_self);
                    }
                } else {
                    _self.doGuessProcess(_self.guesses[_self.guessIndex], _self, _self.guesses[_self.guessIndex].tokens);
                }
            }
        }

        /*****************************************
         * private methods
         *****************************************/

        /**
         * reset guesses to orignal state
         *
         * @param {any} _self
         *
         * @memberOf Language
         */

    }, {
        key: 'resetGuesses',
        value: function resetGuesses(_self) {
            _self.finalObject = [];
            _self.processStarted = false;
            _self.guesses = [];
            _self.guessIndex = 0;
            _self.run = '';
            _self.originalSpeech = '';
        }

        /**
         * Remove empty values from memory object
         * and update/set context if any
         *
         * @param {any} memory
         * @param {any} _self
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'removeEmptyKeysSetContextAndProps',
        value: function removeEmptyKeysSetContextAndProps(memory, _self, _tokens, __obj__) {
            var new_context = __obj__.new_context ? __obj__.new_context : null;
            var sub_context = __obj__.sub_context ? __obj__.sub_context : null;

            var firstSetUniqueTags = _self.unique(memory, _self);
            var secondSetUniqueTags = _self.unique(memory, _self, firstSetUniqueTags);

            // get unique tags and set crud and state
            memory = Object.assign({}, {
                crud: __obj__.crud,
                state: __obj__.state,
                tags: firstSetUniqueTags.concat(secondSetUniqueTags)
            }, __obj__.extends, memory);

            // remove state if no value. only needed for update crud mode
            if (memory.state === undefined) {
                memory.state = null;
            }

            /*
             * Overrides context if developer provides own implementation
             */
            // try to set context on contextFuncs
            if (_self.contextFuncs.length > 0) {
                var _memoryFunc = Object.assign({}, memory);
                var _main_object = _memoryFunc.main_object;

                delete _memoryFunc.main_object;
                delete _memoryFunc.context;

                _memoryFunc = Object.assign({}, { context: _main_object }, _memoryFunc);

                _self.contextFuncs.forEach(function (obj) {
                    var _context_ = null;

                    _self.contextes.forEach(function (_cont) {
                        if (obj.name === _cont.context) {
                            _context_ = _cont;
                        }
                    });

                    if (_context_ && obj.func(_context_, _memoryFunc)) {
                        new_context = _context_.context;
                    }
                });
            }

            // delete empty key/values
            if (new_context !== null) {
                delete memory.context;
            } else {
                new_context = memory.context;
                delete memory.context;
            }
            delete memory.main_object;

            // set context sub and main to '' if undefined
            var contextValue = new_context === undefined || new_context === null ? _self.mainContext : new_context;
            var subContextValue = sub_context === new_context || sub_context === undefined || sub_context === null ? '' : sub_context;

            // set the crud value
            var crudValue = memory.crud === "" || memory.crud === null ? _self.mainCrud : memory.crud;

            // delete matches from tags to context or sub context
            memory.tags = memory.tags.reduce(function (acc, tag) {
                if (!subContextValue.includes(tag) && !contextValue.includes(tag)) {
                    acc.push(tag);
                }

                return acc;
            }, []);

            // set the main Context and CRUD
            _self.mainContext = contextValue;
            _self.mainCrud = memory.crud;

            // setup memory to return data in the requested format
            if (_self.format === 'values-and-pos') {
                memory = _self.formatMemory(memory);
            } else if (_self.format === 'values') {
                memory = _self.formatMemory(memory, ['subject', 'action', 'object', 'interjection', 'tense', 'is_question', 'question_type', 'sentiment', 'sentiment_words']);
            }

            console.log(_self.contextes);
            // create mapping key
            var mappingKey = Object.keys(memory).reduce(function (acc, key) {
                var contextMatch = false;

                _self.contextes.forEach(function (obj) {
                    if (obj.context === memory.context && obj.hasOwnProperty('properties') || obj.context === contextValue && obj.hasOwnProperty('properties')) {
                        obj.properties.forEach(function (property) {
                            if (property.name === key) {
                                contextMatch = true;
                                console.log(key);
                            }
                        });
                    }
                });

                if (Array.isArray(memory[key]) && memory[key].length > 0 && key !== 'tags' && contextMatch === true) {
                    acc.push(key);
                }

                return acc;
            }, []).concat([subContextValue, contextValue]).filter(function (value) {
                return value !== undefined && value !== null && value !== '';
            }).reverse().join('_');

            return Object.assign({}, { context: contextValue, sub_context: subContextValue }, memory, { crud: crudValue, mapping_key: mappingKey });
        }

        /**
         * Format the results to only return the request data
         *
         * @param {any} memory
         * @param {any} valuesToIgnore
         * @returns
         * @memberof Language
         */

    }, {
        key: 'formatMemory',
        value: function formatMemory(memory) {
            var valuesToIgnore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

            return Object.keys(memory).reduce(function (acc, key) {
                var _pos = valuesToIgnore;

                if (Array.isArray(memory[key])) {
                    if (memory[key].length > 0 && !_pos.includes(key)) {
                        acc[key] = memory[key];
                    }
                } else if (!_pos.includes(key)) {
                    acc[key] = memory[key];
                }
                return acc;
            }, {});
        }

        /**
         * Tag object method is a helper to above tagWords(); pulls entities
         *
         * @param {any} str
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'tagObj',
        value: function tagObj(str) {
            var tags = this.tagWords(str).tags;
            var patterns = ["NN", "NNP", "NNPS", "NNS", "VBG", "JJ", "JJR", "JJS"];
            var entities = [];

            entities = tags.reduce(function (acc, tag) {
                if (tag[0] !== SYSTEM_NAME) {
                    if (patterns.includes(tag[1])) {
                        acc.push(tag[0]);
                    }
                }

                return acc;
            }, []);

            return entities;
        }

        /**
         * Parse the return results from dbpedia and get subjects, types with uri type
         *
         * @param {any} output
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'dbPediaParse',
        value: function dbPediaParse(output) {
            var results = output.response.Resources;
            var simScorePassOnePointOne = false;

            // get the similiarity score
            var similarityScores = function similarityScores() {
                var scores = [];
                for (var r = 0; r < results.length; r++) {
                    if (results[r]["@similarityScore"][0] === "1" || results[r]["@similarityScore"][0] === 1) {
                        scores = [r];
                        simScorePassOnePointOne = true;
                        break;
                    } else {
                        var score = Number(results[r]["@similarityScore"].replace("0.", "").substring(0, 5));
                        scores.push(score);
                    }
                }
                return scores;
            };
            var scores = similarityScores();

            // get the index of the greatest similiarity score
            var index = function index(simScore) {
                var scores = simScore;
                var ix = null;
                for (var i = 0; i < scores.length; i++) {
                    if (scores[i] === Math.max.apply(Math, _toConsumableArray(scores))) {
                        ix = i;
                        break;
                    }
                }
                return ix;
            };
            var idx = simScorePassOnePointOne ? scores[0] : index(scores);

            // get the types from pedia
            var types = function types() {
                var uriRes = results[idx].hasOwnProperty("@URI") ? results[idx]["@URI"] : null;
                var uriType = function uriType(uri) {
                    if (uri) {
                        var uriBreak = uri.split("/");
                        return uriBreak[uriBreak.length - 1].toLowerCase();
                    } else return "";
                };

                if (results[idx]["@types"] !== "" || results[idx]["@types"] === undefined) {
                    var typeRemove = results[idx]["@types"].replace(/(DBpedia:|Schema:)/ig, "");
                    var typeBreak = typeRemove.match(",") ? typeRemove.split(",") : [typeRemove];
                    for (var tb = 0; tb < typeBreak.length; tb++) {
                        typeBreak[tb] = typeBreak[tb].match("/") ? uriType(typeBreak[tb]) : typeBreak[tb].toLowerCase();
                    }
                    return typeBreak.concat(uriType(uriRes));
                } else return [uriType(uriRes)];
            };
            types = types();

            // remove duplicate types if any
            var noDuplicateTypes = types.filter(function (elem, pos) {
                return types.indexOf(elem) == pos;
            });

            return { main_object: results[idx]["@surfaceForm"].toLowerCase(), types: noDuplicateTypes };
        }

        /**
         * Get the sentiment from speech string
         *
         * @param {any} str
         * @param {any} subject
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getSentiment',
        value: function getSentiment(str, subject) {
            var sentiment = _speakeasyNlp2.default.sentiment.analyze(str);

            var isNotOK = function isNotOK(str) {
                var sent = "neutral";
                if (str.match("is ok") && subject.match(SYSTEM_NAME)) sent = "positive";else if (str.match("not ok") && subject.match(SYSTEM_NAME)) sent = "negative";
                return sent;
            };

            if (sentiment.comparative > 0) {
                var expr = /(don't|not|donot)+/ig;
                sentiment.score = expr.test(str) ? "negative" : "positive";
            } else if (sentiment.comparative < 0) {
                var _expr = /(don't|not|donot)+/ig;
                sentiment.score = _expr.test(str) ? "positive" : "negative";
            } else sentiment.score = isNotOK(str);

            return sentiment;
        }

        /**
         * Create a armis memory to add to the search index
         *
         * @param {any} dbPediaObj
         * @param {any} obj
         * @param {any} sentiment
         * @param {any} sentimentWords
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'createMemoryObj',
        value: function createMemoryObj(dbPediaObj, obj, sentiment, sentimentWords) {
            return {
                context: obj.context,
                main_object: dbPediaObj.main_object,
                date: obj.dates,
                time: obj.times,
                people: obj.people,
                places: obj.places,
                phone: obj.phones,
                email: obj.emails,
                link: obj.links,
                file: obj.files,
                directory: obj.directories,
                number: obj.numbers,
                subject: obj.subject,
                action: obj.verbs,
                object: obj.object,
                interjection: obj.interjection,
                tense: obj.tense,
                is_question: obj.is_question,
                question_type: obj.question_type,
                sentiment: sentiment.score,
                sentiment_words: sentimentWords
            };
        }

        /**
         * Check the verb form to see if one verb can be set as an object
         * if no main_object or object provide check if verb is the VBG form
         *
         * @param {any} verbs
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'checkVerbForms',
        value: function checkVerbForms(verbs) {
            if (verbs && verbs !== "") {
                var vrbs = verbs.match(" ") ? verbs.split(" ") : [verbs];
                var forms = _nlp_compromise2.default.verb(vrbs).conjugate();
                var gerund = "";

                if (forms) {

                    Object.keys(forms).forEach(function (form) {
                        if (form === "gerund") {
                            gerund = forms[form];
                        }
                    });
                }

                return gerund;
            } else {
                return "";
            }
        }

        /**
        * Get ngrams uni, bi, tri, or n
        *
        * @param {any} str
        * @param {any} n
        * @returns
        *
        * @memberOf Language
        */
        // getNGrams(str, n) {
        //     let NGrams = natural.NGrams;
        //     let nGramSpeech = NGrams.ngrams(str, n);

        //     return nGramSpeech;
        // }


        /**
         * Pull unique tokens from context, main_object, object property
         *
         * @param {any} pos
         * @returns
         *
         * @memberOf Memories
         */

    }, {
        key: 'unique',
        value: function unique(pos, _self, _tags) {
            var tags = _self.tagObj(pos.context + ' ' + pos.main_object + ' ' + pos.object);

            tags = _tags ? Sugar.Array.remove(tags, function (n) {
                return _tags.filter(function (_tag) {
                    return n === _tag;
                }).length > 0;
            }) : tags;

            tags = Sugar.Array.most(tags, true);
            tags = Sugar.Array.unique(tags).reduce(function (acc, _tag) {
                if (_tag.length > 2 && _tag !== undefined && _tag !== 'undefined' && _tag !== null) {
                    acc.push(_tag);
                }
                return acc;
            }, []);

            tags = Sugar.Array.remove(tags, 'null');
            return tags;
        }

        /**
         * Get an actually time from some wording saying Ex: "in two days from now"
         *
         * @param {any} tokensToStr
         * @returns
         *
         * @memberOf Language
         */

    }, {
        key: 'getTimeFromSaying',
        value: function getTimeFromSaying(tokensToStr) {
            var keepTimeFormat = false;
            var tense = null;
            var timePatterns = [["this week", null], ["now", null], ["today", null], ["yesterday", false], ["tomorrow", true], ["next {0}", true], ["last {0}", false], ["{0} {1}", null], ["in an {0}", null], ["in a {0}", null], ["in {0} {1}", true], ["{0} {1} ago", false], ["the {0}{1}", null], ["next week {0}", true], ["last week {0}", false], ["the end of {0}", true], ["end of the day", true], ["end of the week", true], ["end of the month", true], ["end of the year", true], ["in half a year", true], ["in half an hour", true], ["half an hour ago", false], ["an {0} from now", true], ["a {0} from now", true], ["{0} {1} from now", true], ["{0} days from today", true], ["{0} weeks from today", true], ["the end of this day", true], ["the end of this week", true], ["the end of this month", true], ["the end of this year", true], ["beginning of the day", true], ["beginning of the week", true], ["beginning of the month", true], ["beginning of the year", true], ["the {0}{1} of {2}", null], ["the end of next {0}", true], ["the end of last {0}", false], ["the {0} day of {1}", null], ["{0} days after {1}", true], ["{0} weeks after {1}", true], ["{0} {1}{2} of last year", false], ["{0} {1}{2} of next year", true], ["{0} days after tomorrow", true], ["{0} weeks after tomorrow", true], ["the last day of {0}", true], ["the beginning of this day", true], ["the beginning of this week", true], ["the beginning of this month", true], ["the beginning of this year", true], ["the first {0} of {1}", true], ["the second {0} of {1}", true], ["the third {0} of {1}", true], ["the fourth {0} of {1}", true]];

            // check oddie times exist
            var timeStr = timePatterns.reduce(function (acc, patterns) {
                var pattern = patterns[0];

                // pattern to token string
                if (tokensToStr.includes(pattern)) {
                    acc = pattern;
                    tense = patterns[1];
                } else {
                    // handle days
                    _times2.default.days.forEach(function (day) {
                        var dayPattern = Sugar.String.format(pattern, day);

                        if (tokensToStr.includes(dayPattern)) {
                            acc = dayPattern;
                            tense = patterns[1];
                        }

                        if (pattern === "{0} days after {1}" || pattern === "{0} weeks after {1}") {
                            for (var i = 1; i < 1000; i++) {
                                var numberDayPattern = Sugar.String.format(pattern, i, day);

                                if (tokensToStr.includes(numberDayPattern)) {
                                    acc = numberDayPattern;
                                    tense = patterns[1];
                                }
                            }

                            _times2.default.numbers_spelled.forEach(function (number) {
                                var numberDayPattern = Sugar.String.format(pattern, number, day);

                                if (tokensToStr.includes(numberDayPattern)) {
                                    acc = numberDayPattern;
                                    tense = patterns[1];
                                }
                            });
                        }

                        if (pattern === "the first {0} of {1}" || pattern === "the second {0} of {1}" || pattern === "the third {0} of {1}" || pattern === "the fourth {0} of {1}") {

                            _times2.default.months.forEach(function (month) {
                                var dayMonthPattern = Sugar.String.format(pattern, day, month);

                                if (tokensToStr.includes(dayMonthPattern)) {
                                    acc = monthPattern;
                                    tense = patterns[1];
                                }
                            });
                        }

                        if (!acc && tokensToStr.includes(day)) {
                            acc = day;
                            tense = null;
                        }
                    });

                    // handle months
                    _times2.default.months.forEach(function (month) {
                        var monthPattern = Sugar.String.format(pattern, month);

                        if (tokensToStr.includes(monthPattern)) {
                            acc = monthPattern;
                            tense = patterns[1];
                        }

                        if (pattern === "{0} {1}{2} of last year" || pattern === "{0} {1}{2} of next year" || pattern === "{0} {1}") {
                            _times2.default.date_endings.forEach(function (dateEnding) {
                                for (var i = 1; i < 32; i++) {
                                    var monthDatePattern = Sugar.String.format(pattern, month, i, dateEnding);

                                    if (tokensToStr.includes(monthDatePattern)) {
                                        acc = monthDatePattern;
                                        tense = patterns[1];
                                    }
                                }
                            });

                            for (var i = 1; i < 32; i++) {
                                var monthDatePattern = Sugar.String.format(pattern, i, month);

                                if (tokensToStr.includes(monthDatePattern)) {
                                    acc = monthDatePattern;
                                    tense = patterns[1];
                                }
                            }
                        }
                    });

                    // handle day times
                    _times2.default.day_times.forEach(function (time) {
                        var timeDayPattern = Sugar.String.format(pattern, time);

                        if (tokensToStr.includes(timeDayPattern)) {
                            acc = timeDayPattern;
                            tense = patterns[1];
                            if (time === 'second' || time === 'minute' || time === 'hour') {
                                keepTimeFormat = true;
                            }
                        }

                        if (pattern === "in {0} {1}" || pattern === "{0} {1} ago" || pattern === "{0} {1} from now") {
                            for (var i = 1; i < 1000; i++) {
                                var sInTime = i > 1 ? time + 's' : time;
                                var timeNumberPattern = Sugar.String.format(pattern, i, sInTime);

                                if (tokensToStr.includes(timeNumberPattern)) {
                                    acc = timeNumberPattern;
                                    tense = patterns[1];
                                    if (time === 'second' || time === 'minute' || time === 'hour') {
                                        keepTimeFormat = true;
                                    }
                                }
                            }

                            var timeNumberPatternWithA = Sugar.String.format(pattern, 'a', time);
                            var timeNumberPatternWithAn = Sugar.String.format(pattern, 'a', time);

                            if (tokensToStr.includes(timeNumberPatternWithA) || tokensToStr.includes(timeNumberPatternWithAn)) {
                                acc = timeNumberPatternWithA;
                                tense = patterns[1];
                                if (time === 'second' || time === 'minute' || time === 'hour') {
                                    keepTimeFormat = true;
                                }
                            }
                        }
                    });

                    // handle weeks, months, and year times
                    _times2.default.times.forEach(function (time) {
                        var timeDayPattern = Sugar.String.format(pattern, time);

                        if (tokensToStr.includes(timeDayPattern)) {
                            acc = timeDayPattern;
                            tense = patterns[1];
                        }

                        if (pattern === "in {0} {1}" || pattern === "{0} {1} ago" || pattern === "{0} {1} from now") {
                            for (var i = 1; i < 1000; i++) {
                                var timeNumberPattern = Sugar.String.format(pattern, i, time);

                                if (tokensToStr.includes(timeNumberPattern)) {
                                    acc = timeNumberPattern;
                                    tense = patterns[1];
                                }
                            }
                        }
                    });
                }

                return acc;
            }, null);

            if (timeStr) {
                var newTimeStr = keepTimeFormat === true ? Sugar.Date.format(new Date(Sugar.Date.create(timeStr)), '{do} {month} {yyyy} {hh}:{mm} {tt}') : Sugar.Date.format(new Date(Sugar.Date.create(timeStr)), '{do} {month} {yyyy}');
                timeStr = tokensToStr.replace(timeStr, newTimeStr);
            }

            return { time: timeStr, tense: tense };
        }

        /**
         * Check to see if properties for a context is missing, if so provide responses.
         *
         * @param {any} _self
         * @memberof Language
         */

    }, {
        key: 'missingProperties',
        value: function missingProperties(_self) {
            return _self.guesses.reduce(function (acc, obj) {
                if (obj.context) {
                    var _responses = _self.contextes.reduce(function (_acc, _context) {
                        if (obj.context === _context.context) {
                            if (_context.hasOwnProperty('properties') && _context.properties.length > 0) {

                                _context.properties.forEach(function (property) {
                                    var hasPropertyInExtends = false;

                                    _self.extends.forEach(function (extObj) {
                                        if (extObj.name === property.name) {
                                            hasPropertyInExtends = true;
                                        }
                                    });

                                    if (hasPropertyInExtends) {
                                        if (!Object.keys(obj).includes(property.name) || Object.keys(obj).includes(property.name) && obj[property.name].length === 0) {
                                            var _response = _self.generateResponseForMissingProperty(property);

                                            _self.properties.push(property.name);
                                            _acc.push(_response);
                                        }
                                    } else {
                                        throw new Error('Armis Error: Property \'' + property.name + '\' must have an extended method!');
                                    }
                                });
                            }
                        }

                        return _acc;
                    }, []);

                    if (_responses.length > 0) {
                        var randomResponse = _responses3.default.random[Math.floor(Math.random() * _responses3.default.random.length)];

                        acc.push({
                            context: obj.context,
                            sub_context: obj.sub_context,
                            tags: obj.tags,
                            responses: _responses.concat([randomResponse])
                        });
                    }
                }

                return acc;
            }, []);
        }

        /**
         * Creates a response for a missing property
         *
         * @param {any} property
         * @returns
         * @memberof Language
         */

    }, {
        key: 'generateResponseForMissingProperty',
        value: function generateResponseForMissingProperty(property) {
            if (property.hasOwnProperty('noun') && property.hasOwnProperty('multi') && property.multi === true) {
                return Sugar.String.format(_responses3.default[property.noun], property.name, 's', 'are');
            } else if (property.hasOwnProperty('noun')) {
                return Sugar.String.format(_responses3.default[property.noun], property.name, '', 'is');
            } else {
                throw new Error('\n             Armis Error: property object missing \'noun\' key\n             (Ex: { name: \'A Name\', noun: \'person\' | \'place\' | \'thing\'})\n            ');
            }
        }
    }]);

    return Language;
}();

exports.default = Language;