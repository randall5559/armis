'use strict';

// utilities
const isOnline = require('is-online');

//import Sugar to do some cool tricks on memories
require('sugar/polyfills/es6');
const Sugar = require('sugar');

//import json file(s)
import urlExts from '../assets/url-ext.json';
import actions from '../assets/actions.json';
import times from '../assets/times.json';
import state from '../assets/state.json';
import responses from '../assets/responses.json';

import moment from 'moment';
import Knwl from 'knwl.js';

// nlp modules
import speak from 'speakeasy-nlp';
import nlp from 'nlp_compromise';
import compromise from 'compromise';
import pos from 'pos';
import stem from 'stem-porter';
import dbpedia from 'dbpedia-spotlight';
// import natural from 'natural';
import sentim from 'sentiment';
// import synonyms from 'find-synonyms';

//constants
const SYSTEM_NAME = "armis";


export default class Language {

    /**
     * Creates an instance of Language.
     *
     * @memberOf Language
     */
    constructor(obs$) {
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
        this.baseProperties = ['date', 'time', 'phone', 'email', 'link', 'file', 'directory', 'number', 'person'];

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

        isOnline().then(online => {
            //this.hasWifi = online;
            //=> true
        });
    }


    /**
     * Trigger a time of how long Armis will persist a context
     *
     * @memberof Language
     */
    timeContext() {
        // reset and reset context timer
        if (this.clearMainContext) {
            clearTimeout(this.clearMainContext);
        }

        this.clearMainContext = setTimeout(() => {
            this.clearContext();
        },  this.contextTime);
    }


    /**
     * Process a token sentence
     *
     * @param {any} _tokens
     *
     * @memberOf Language
     */
    process(args) {
        // reset and reset context timer
        this.timeContext();

        if (!this.processStarted) {
            // lower case all tokens
            let _tokens = args.map(token => token.toString().toLowerCase());

            this.processStarted = true;
            this.originalSpeech = _tokens.join(' ');

            // remove armis if the token index is anywhere except 0 index
            Sugar.Array.remove(_tokens, SYSTEM_NAME);

            // call methods sequentially
            [
                this.uncontract,
                this.tagWords,
                this.segmentize
            ]
            .reduce((acc, method) => method(acc, this, _tokens), _tokens);
        } else if (this.properties.length > 0) {
            // get the last object in the finalObject array
            let _final = this.finalObject[this.finalObject.length - 1];

            // handle custom added properties with extend
            let extendObj = this.extends
                .reduce((acc, obj) => {
                    acc[obj.name] = obj.func(args);

                    return acc;
                }, {});


            this.guesses = this.guesses.reduce((acc, guess, index) => {
                this.properties.forEach((property) => {
                    if (Object.keys(guess).includes(property)) {
                        let objProp = {};
                            objProp[property] = extendObj[property];
                        guess = Object.assign({}, guess,  objProp);
                    }
                });

                acc.push(guess);

                return acc;
            }, []);

            this.final(
                Object.assign({}, _final.obj, { extends: extendObj }),
                this,
                _final.tokens
            );
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
    doGuessProcess(_obj, _self, _tokens) {
        _self.guessIndex++;

         // call methods sequentially
        [
            this.tagWords,
            this.isQuestion,
            this.pullTextParams,
            this.getSubject,
            this.getVerbs,
            this.getObject,
            this.establishContext,
            this.getTense,
            this.getInterjection,
            this.final
        ]
        .reduce((acc, method) => method(acc, _self, _tokens), _obj);
     }


    /**
     * get the specify context
     *
     * @param {any} string
     * @returns
     *
     * @memberOf Language
     */
    getContext(string) {
        return this.contextes.reduce((acc, obj) => {
            if(obj.context === string) {
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
    setContext(obj) {
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
        let index = this.contextes
            .reduce((acc, _obj, index) => {
                if (_obj.context === obj.context) {
                    acc = index;
                }

                return acc;
            }, null);

        // set context if exist by index or push new object with tags to contextes array
        if (index) {
            this.contextes[index].tags.concat(obj.tags);

            if (obj.hasOwnProperty('sub_context') && obj.sub_context.length > 0) {
                this.contextes[index].sub_context
                    .forEach(_obj => {
                            obj.sub_context.forEach(sub_obj => {
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
                obj.sub_context
                    .forEach(_cont => {
                        try {
                            _cont.tags.forEach(_tag => {
                                if (obj.tags.includes(_tag)) {
                                    throw new Error(`Armis Error: can\'t have tag '${_tag}' in main and sub context schema!`);
                                }
                            });

                            obj.tags.push(_cont.context);
                            _cont.tags.push(_cont.context);
                        } catch(e) {
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
    removeContext(_context_) {
        this.contextes = this.contextes
            .reduce((acc, _cont) => {
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
    clearContext() {
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
    uncontract(tokens) {
        let _tokens_ = tokens
            .reduce((_tokens, token, index, collection) => {
                let hasSpecialChar = /[\W_]+/g.test(token);

                // if (index === 0) {
                //     _tokens.push(SYSTEM_NAME);
                // }

                let _token = token;

                [["let's","let us"],
                ["let\'s","let us"],
                ["n't"," not"],
                ["n\'t"," not"],
                ["'re"," are"],
                ["'d"," should"," would"," had"],
                ["'ll"," will"],
                ["'s"," is"," has"],
                ["i'm","i am"]]

                .forEach(contraction => {
                    if(_token.includes(contraction[0])) {
                        _token = token.replace(contraction[0], contraction[1]);
                        _token = Sugar.String.words(_token);
                        _tokens.push(_token[0]);
                        _tokens.push(_token[1]);
                    }
                });

                // only push tokens that don't have special characters in them
                //if (!hasSpecialChar) {
                if(!Sugar.Object.isArray(_token)) {
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
    tagWords(_obj) {
        let str = (typeof _obj === 'string') ? _obj : _obj.tokens.join(' ');
        let words = new pos.Lexer().lex(str);
        let tagger = new pos.Tagger();
        let taggedWords = tagger.tag(words);

        // remove or other punction
        if(str) {
            if( taggedWords[taggedWords.length-1][0] === "." ||
                taggedWords[taggedWords.length-1][0] === "?" ||
                taggedWords[taggedWords.length-1][0] === "!" ) taggedWords.pop();
        }

        /*
        * fix tags like "I" should be PRP but it's NN and "Like" and
        * "Love" should be VB not IN and NN with the "pos" node_module
        *  also will add other words over time
        */
        [["i", "PRP"],["like", "VB"],["love", "VB"],["hope", "VB"],["plan", "VB"],["change", "VB"],["review", "VB"],
        ["move", "VB"],["use", "VB"],["aways", "RB"],["away", "RB"],["cherry", "NN"],["set", "VB"],["switch","VB"],
        ["need", "VB"],["shut", "VB"],["removed", "VB"],["wash", "VB"],["display","VB"],["show","VB"]]
            .forEach(fix => {
                taggedWords.forEach(tag => {
                    if (tag[0] === fix[0]) {
                        tag[1] = fix[1];
                    }
                })
            });

        return Object.assign({}, _obj, { tags : taggedWords, speech : str });
    }


    /**
     * Segmentize take sentences and breaks them up depending on contend or other
     * TODO:
     * split speech up into separate sentences if "and, or, but" is present
     */
    segmentize(_obj, _self, _tokens) {
        // comment out these tags for now as starting tags are needed
        let patterns = ["MD","VB","VBG","VBD","VBN","VBP","VBZ" /*"RBR","RBS","RP","RB"*/];
        let separateWords = ['and', 'but', 'however', 'otherwise', 'plus'];
        let joiningWords = ['because', 'unless', 'then', 'until', 'if'];
        let countToBreakContext = 0;
        let lockContext = false;
        let lockAction = false;
        let contObj = {
            context: null,
            sub_context: null,
            tokens: []
        };

        let clearContObj = () => {
            countToBreakContext = 1;
            lockContext = false;
            lockAction = false;
            contObj = {
                context: null,
                sub_context: null,
                tokens: []
            };
        };

        let tryContextBreak = (_context_, _subContext_) => {
            if (!lockContext) {
                contObj.context = (!contObj.context) ? _context_ : contObj.context;
                contObj.sub_context = (!contObj.sub_context) ? _subContext_ : contObj.sub_context;
                lockContext = true;

                return true;
            } else if (_context_ !== contObj.context && _subContext_ !== contObj._sub_cont && lockAction) {
                contObj.context = (!contObj.context) ? _context_ : contObj.context;
                contObj.sub_context = (!contObj.sub_context) ? _subContext_ : contObj.sub_context;
                lockContext = true;

                return true;
            }
        }

        // break context up
        _self.guesses = _obj.tags
            .reduce((acc, tag, index) => {
                let token = tag[0];
                let pos = tag[1];
                let trybreakIt = () => {
                    countToBreakContext++;
                    if (countToBreakContext === 3 && index < (_obj.tags.length-1)) {
                        acc.push(contObj);
                        clearContObj();
                    }
                }

                _self.contextes.forEach(_cont => {
                    let shouldIgnore = (_cont.hasOwnProperty('ignores')) ?
                        _cont.ignores.filter(ignore => _tokens.join('-').includes(ignore.toLowerCase())).length > 0 :
                        false;

                    let shouldRequire = false;

                    if (_cont.hasOwnProperty('requires')) {
                        shouldRequire = _cont.requires.filter(require => _tokens.join('-').includes(require.toLowerCase())).length > 0;
                    } else if (!_cont.hasOwnProperty('requires')) {
                        shouldRequire = true;
                    }

                    if (!shouldIgnore && shouldRequire) {
                        if(_cont.hasOwnProperty('sub_context')) {
                            _cont.sub_context.forEach(_sub_cont => {
                                if (index > 1 && _sub_cont.tags.includes(`${_obj.tags[index-2][0]}-${_obj.tags[index-1][0]}-${token}`) ||
                                    index > 0 && _sub_cont.tags.includes(`${_obj.tags[index-1][0]}-${token}`) ||
                                    _sub_cont.tags.includes(token)) {
                                        trybreakIt();
                                        tryContextBreak(_cont.context, _sub_cont.context);
                                }
                            });
                        }

                        if (contObj.context === null && contObj.sub_context === null) {
                            if (index > 1 && _cont.tags.includes(`${_obj.tags[index-2][0]}-${_obj.tags[index-1][0]}-${token}`)) {
                                trybreakIt();
                                tryContextBreak(_cont.context, '');
                                // tryContextBreak(_cont.context, `${_obj.tags[index-2][0]} ${_obj.tags[index-1][0]} ${token}`);
                            } else if (index > 0 && _cont.tags.includes(`${_obj.tags[index-1][0]}-${token}`)) {
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

                if (index === (_obj.tags.length-1) && lockAction && lockContext) {
                    acc.push(contObj);
                    clearContObj();
                }

                if (joiningWords.includes(token) && index > 1) {
                    _self.run = 'join';
                } else if (separateWords.includes(token)) {
                    _self.run = 'individual'
                }

                return acc;
            }, []);

        // try with word breaks
        let testForBreakWord = (_startIndex, _endIndex, _run) => {
            clearContObj();
            _self.run = _run;
            let hasAction = false;
            let _objSlice = _obj.tags.slice(_startIndex, _endIndex);

            return _objSlice
                .reduce((acc, _tag, index) => {
                    let token = _tag[0];
                    let pos = _tag[1];

                     _self.contextes.forEach(_cont => {
                        let shouldIgnore = (_cont.hasOwnProperty('ignores')) ?
                        _tokens.filter(token => _cont.ignores.includes(token)).length > 0 :
                        false;

                        if (!shouldIgnore) {
                            if(_cont.hasOwnProperty('sub_context')) {
                                _cont.sub_context.forEach(_sub_cont => {
                                    if (index > 1 && _sub_cont.tags.includes(`${_objSlice[index-2][0]}-${_objSlice[index-1][0]}-${token}`) ||
                                        index > 0 && _sub_cont.tags.includes(`${_objSlice[index-1][0]}-${token}`) ||
                                        _sub_cont.tags.includes(token)) {
                                            tryContextBreak(_cont.context, _sub_cont.context);
                                    }
                                });
                            }

                            if (contObj.context === null && contObj.sub_context === null) {
                                if (index > 1 && _cont.tags.includes(`${_objSlice[index-2][0]}-${_objSlice[index-1][0]}-${token}`)) {
                                    tryContextBreak(_cont.context, `${_objSlice[index-2][0]} ${_objSlice[index-1][0]} ${token}`);
                                } else if (index > 0 && _cont.tags.includes(`${_objSlice[index-1][0]}-${token}`)) {
                                    tryContextBreak(_cont.context, `${_objSlice[index-1][0]}-${token}`);
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

                    if (index === (_objSlice.length-1) /*&& hasAction*/) {
                        acc = contObj;
                    }

                    return acc;
                }, {});

        }

        // see if joining or separate exist in tokens
        let hasOneCanBreak = (__tokens__) => {
            return __tokens__
                .reduce((acc, _token) => {
                    if(joiningWords.includes(_token) || separateWords.includes(_token)) {
                        acc = true;
                    }

                    return acc;
                }, false);
        }

        if (_self.guesses.length === 0 || _self.guesses.length === 1  && hasOneCanBreak(_self.guesses[0].tokens)) {
            // try with word breaks
            _self.guesses = _obj.tags
                .reduce((acc, _tag, index) => {
                    let token = _tag[0];
                    let pos = _tag[1];

                    let pushWords = (_index_, _objTags_, _run_) => {
                        let rightSide = testForBreakWord(0, _index_, _run_);
                        let leftSide = testForBreakWord((_index_+1), _objTags_.length, _run_);

                        if (Object.keys(rightSide).length > 0) {
                            acc.push(rightSide);
                        }

                        if (Object.keys(leftSide).length > 0) {
                            acc.push(leftSide);
                        }
                    };

                    if (separateWords.includes(token) && index > 1 && !joiningWords.includes(_obj.tags[index+1][0])) {
                        pushWords(index, _obj.tags, 'individual');
                    } else if (joiningWords.includes(token) && index > 1) {
                        pushWords(index, _obj.tags, 'join');
                    }

                    return acc;
                }, []);

            if (_self.guesses.length === 1) {
                _self.guesses[0].tokens = _obj.tokens;
            }

        } else  {
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
    isQuestion(obj, _self, _tokens) {
        let isQuestion = false;
        let questionType = '';
        let startWords = ['did', 'do', 'would', 'should', 'are', 'is', 'has', 'can'];
        let whWords = ['who', 'where', 'when', 'why', 'what', 'which', 'how'];
        let notWords = [
            'do you', 'do we', 'do they', 'does she', 'does he', 'do i',
            'do not you', 'do not we', 'do not they', 'do not she', 'do not he', 'do not i',
            'is not you', 'is not we', 'is not they', 'is not she', 'is not he', 'is not i', 'is not there',
            'are not you', 'are not we', 'are not they', 'are not she', 'are not he', 'are not i', 'are not there',
            'are you', 'are we', 'are they', 'are there'];

        // wh- questions
        whWords.forEach(word => {
            if(_tokens.includes(word)) {
                isQuestion = true;
                questionType = 'wh';
            }
        });

        // - not - questions
        notWords.forEach(words => {
            if (obj.speech.match(words)) {
                isQuestion = true;
                questionType = 'tag';
            }
        });

        // start word questions
        startWords.forEach(word => {
            if(_tokens[0] === word) {
                isQuestion = true;
                questionType = 'yes_no';
            }

            // or type
            if(_tokens[0] === word && _tokens.includes('or')) {
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
    pullTextParams(obj, _self, _tokens) {
        let _obj = Object.assign({}, obj);
        let context = null;

        // check if there a word saying that relates to time
        let timeSaying = _self.getTimeFromSaying(_tokens.join(' '));
        let str = (timeSaying.time) ? timeSaying.time : _tokens.join(' ');
        _obj = Object.assign({}, _obj, { tense: timeSaying.tense });

        // use to pull phone, email, website, date, time
        let knwlInstance = new Knwl('english');
        knwlInstance.init(str);

        // person
        let person = compromise(str)
            .people()
            .normalize()
            .sort('frequency')
            .unique()
            .out('array');

        // places
        let places = compromise(str)
            .places()
            .sort('alpha')
            .out('array');

        // pull a file from string if any
        let files = _tokens.reduce((acc, token) => {
            let isFile = /(?:\.([^.]+))?$/i.exec(token)[1];
            let notEmail = /\w+@\w+\.\w+/g.test(token);
            let notLink = /[://]+/.test(token);

            if (isFile !== undefined && !notEmail && !notLink) {
                if (!urlExts.includes(isFile)) {
                    acc.push(token);
                }
            }

            return acc;
        }, []);

        // pull directories from string
        let dirs = _tokens.reduce((acc, token) => {
            let isDir = /(\w|\W)*\/\w+/i.test(token);
            let isFile = /(?:\.([^.]+))?$/i.exec(token)[1];

            if (isDir && !urlExts.includes(isFile)) {
                acc.push(token);
            }

            return acc;
        }, []);

        // pull the phone numbers
        let phones = knwlInstance.get('phones')
            .reduce((acc, phone) => {
                acc.push(phone.phone);
                context = 'phone';
                return acc;
            }, []);

        // pull the web links
        let links = knwlInstance.get('links')
            .reduce((acc, link) => {
                acc.push(link.link);
                context = 'link';
                return acc;
            }, []);

        // pull the emails
        let emails = knwlInstance.get('emails')
            .reduce((acc, email) => {
                acc.push(email.address);
                context = 'email';
                return acc;
            }, []);

        // pull the dates
        let dates = knwlInstance.get('dates')
            .reduce((acc, date) => {
                let month = (date.month === 'unknown') ? new Date().getMonth() : date.month;
                let day = (date.day === 'unknown') ? new Date().getDay() : date.day;
                let year = (date.year === 'unknown') ? new Date().getFullYear() : date.year;

                let _date = `${month}-${day}-${year}`;
                acc.push(_date);
                return acc;
            }, []);

        // pull the times
        let timesKnwl = knwlInstance.get('times')
            .reduce((acc, time) => {
                if (time.daynight === 'Unknown') {
                    time.daynight = _tokens.reduce((acc, token) => {
                        let am = /\d+(am)/g;
                        let pm = /\d+(pm)/g;

                        if (am.test(token)) {
                            acc = 'am';
                        } else if(pm.test(token)) {
                            acc = 'pm';
                        }

                        return acc;
                    }, 'Unknown');
                }

                let _time = (time.daynight === 'Unknown') ? `${time.hour}:${time.minute}` :
                    `${time.hour}:${time.minute} ${time.daynight}`;
                acc.push(_time);
                return acc;
            }, []);

        if (timesKnwl.length === 0 && dates.length > 0) {
            timesKnwl.push(moment().format("h:mm a"));
        }

        // pull the numbers out if any
        let numbers = compromise(str).values().toNumber().out('array');

        // handle custom added properties with extend
         let extendObj = _self.extends
            .reduce((acc, obj) => {
                acc[obj.name] = obj.func(_tokens);

                return acc;
            }, {});

        // provide an initial context if any
        let contextObj = (context) ? { context: context} : {};

        return Object.assign({}, _obj, contextObj, {
            person: person,
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
    getSubject(obj) {
        let _obj = Object.assign({}, obj);
        let sub = [];
        let patterns = ["NN","NNP","NNPS","NNS","VBG","PRP","PRP$","JJ","JJR","JJS","WDT","WP","WP$","WRB","CD"];
        let oddies = ["DT","CC","IN","TO"];
        let firstVerb = ["VB","VBG","VBD","VBN","VBP","VBZ"];
        let _lockSub = false;
        let deepTag = Sugar.Object.get(obj, 'tags[0][1]');

        if(firstVerb && firstVerb.includes(deepTag)) {
            return Object.assign({}, _obj, {
                verb_at_start: true,
                subject: SYSTEM_NAME,
                sub_end_index: 0
            });
        }

        sub = _obj.tags
            .reduce((acc, tag, index) => {
                if(!_lockSub) {
                    let token = tag[0];
                    let pos = tag[1];

                    if (pos === 'VBG' && index === 0) {
                        acc.push(token);
                    } else if(patterns.includes(pos) && pos !== 'VBG') {
                        acc.push(token);
                    } else if(oddies.includes(pos)) {
                        acc.push(token);
                    }

                    if (firstVerb.includes(pos)) {
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
    getVerbs(obj, _self) {
        let _obj = Object.assign({}, obj);
        let verbs = [];
        let verbIsAtStart = (_obj.hasOwnProperty("verb_at_start")) ? _obj.verb_at_start : false;
        let verbStartPos = _obj.sub_end_index;
        let verbEndPos = null;
        let _lockVerbs = false;
        let firstObject = ["NN","NNP","NNPS","NNS","VBG","PRP","PRP$","JJ","JJR","JJS","WDT","WP","WP$","WRB","CD"];
        let patterns = ["MD","VB","VBG","VBD","VBN","VBP","VBZ","RBR","RBS","RP","RB"];
        let notFirstValue = ["RBR","RBS","RP","RB"];
        let oddies = ["IN","TO"]; //"JJ","JJR","JJS"

        if(verbStartPos || verbIsAtStart) {
            verbs = _obj.tags
                .slice(verbStartPos, _obj.tags.length)
                .reduce((acc, tag, index) => {
                    if(!_lockVerbs) {
                        let token = tag[0];
                        let pos = tag[1];

                        if (patterns.includes(pos) && index > 0) {
                            acc.push(token);
                        } else if (!notFirstValue.includes(pos) && index === 0) {
                            acc.push(token);
                        } else if (oddies.includes(pos)) {
                            acc.push(token);
                            _lockVerbs = true;
                        }

                        if (firstObject.includes(pos)) {
                            _lockVerbs = true;
                        }
                    }

                    return acc;
                }, []);
        }

        let actionableState = null;
        let crud = [];

        // do combined verbs/actions to see if CRUD action exist
        Object.keys(actions).forEach(key => {
            let wordJoined = verbs.join('-');
            let rootWord = compromise(wordJoined).out('root');

            if (actions[key].includes(wordJoined)) {
                crud.push(key);
            } else if (actions[key].includes(rootWord)) {
                crud.push(key);
            }

            // set the state
            if (key === 'update') {
                let index = actions[key].indexOf(wordJoined);
                if(index > -1) {
                    actionableState = state[actions[key][index]];
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
            crud = verbs
                .reduce((acc, verb) => {
                    Object.keys(actions).forEach(key => {
                        let rootWord = compromise(verb).out('root');

                        if (actions[key].includes(verb)) {
                            acc.push(key);
                        } else if (actions[key].includes(rootWord)) {
                            crud.push(key);
                        }

                        // set the state
                        if (key === 'update') {
                            let index = actions[key].indexOf(verb);
                            if(index > -1) {
                                actionableState = state[actions[key][index]];
                            }
                        }
                    });

                    return acc;
                }, []);
        }


        // try on subject if not action or crud is found
        if (crud.length === 0) {
            crud = _obj.subject.split(' ')
                .reduce((acc, sub) => {
                    Object.keys(actions).forEach(key => {
                        let rootWord = compromise(sub).out('root');

                        if (actions[key].includes(sub)) {
                            acc.push(key);
                            verbs = [sub].concat(verbs);
                        } else if (actions[key].includes(rootWord)) {
                            acc.push(key);
                            verbs = [sub].concat(verbs);
                        }

                        // set the state
                        if (key === 'update') {
                            let index = actions[key].indexOf(sub);
                            if(index > -1) {
                                actionableState = state[actions[key][index]];
                            }
                        }
                    });

                    return acc;
                }, []);
        }

        // add state to obj if any
        if (actionableState !== null) {
            let expr = /(don't|not|donot)+/ig;

            if(expr.test(_obj.subject + verbs.join(' '))) {
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
            crud: (crud.length > 0) ? crud[0] : '',
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
    getObject(obj) {
        let _obj = Object.assign({}, obj);
        let objItem = [];
        let crud = (obj.crud === '') ? [] : [obj.crud];
        let objStartIndex = _obj.end_index;
        let patterns = ["DT","NN","NNP","NNPS","NNS","VBG","PRP","PRP$","JJ","JJR","JJS"];
        let patternTwo = ["NN","NNP","NNPS","NNS","PRP","PRP$","JJ","JJR","JJS","DT","CC","IN","CD","TO",
                            "VB","VBG","VBD","VBN","VBP","VBZ","RBR","RBS","RP","RB"];

        if(objStartIndex) {
            objItem = _obj.tags
            .slice(objStartIndex, _obj.tags.length)
            .reduce((acc, tag, index) => {
                let token = tag[0];
                let pos = tag[1];

                if ((objStartIndex + index) > objStartIndex) {
                    if (patternTwo.includes(pos)) {
                        acc.push(token);
                    }
                }

                if (patterns.includes(pos) && objStartIndex === (objStartIndex + index)) {
                    acc.push(token);
                }

                return acc;
            }, []);
        }

        let actionableState = null;

        if (crud.length === 0) {
            crud = objItem
                .reduce((acc, objItem) => {
                    Object.keys(actions).forEach(key => {
                        if(actions[key].includes(objItem)) {
                            acc.push(key);
                        }

                        // set the state
                        if (key === 'update') {
                            let index = actions[key].indexOf(objItem);
                            if(index > -1) {
                                actionableState = state[actions[key][index]];
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
            crud: (crud.length > 0) ? crud[0] : ''
        });
    }


    /**
     * Set the context of the conversation with armis and user ( this is important )
     *
     * @memberOf Language
     */
    establishContext(obj, _self) {
        let tokens = _self.tagObj(obj.subject).join(' ');
            tokens = (tokens) ? tokens : _self.tagObj(obj.object).join(' ');

        if(tokens && !obj.hasOwnProperty('context')) {
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
    getTense(obj) {
        let _obj = Object.assign({}, obj);
        let hasPastTag = false;
        let pastPattern = ["VBD","VBN"];
        let futurePattern = ["MD"];
        let tense = "present";

        if(_obj.tense === null) {
             _obj.tags.forEach(tag => {
                let pos = tag[1];

                if (pastPattern.includes(pos)) {
                    tense = "past";
                    hasPastTag = true;
                } else if(futurePattern.includes(pos)) {
                    tense = "future";
                }
            });
        } else {
            if (_obj.tense === 'past') {
                tense = "past";
                hasPastTag = true
            } else {
                tense = "future";
            }
        }

        return Object.assign({}, _obj, {
            tense: (hasPastTag) ? "past" : tense,
            crud: (hasPastTag) ? 'read' : _obj.crud
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
    getInterjection(obj) {
        let _obj = Object.assign({}, obj);
        let patterns = ['UH'];
        let interjection = [];

        interjection = _obj.tags
            .reduce((acc, tag) => {
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
    final(obj, _self, _tokens) {
        // persist in memory the final obj modified (verb, subject, actions, etc.)
        _self.finalObject.push({
            obj: obj,
            tokens: _tokens
        });

        let _obj = Object.assign({}, obj, { tokens: _tokens });

        if (_self.hasWifi && _tokens.length >= 3) {
            // call with wifi mode
            //call out to dbPedia module for wiki for types, main subjects, and definitions
            dbpedia.annotate( _obj.speech , (output) => {
                let dbPediaObj = (output.hasOwnProperty("response") && output.response.hasOwnProperty("Resources")) ?
                                    _self.dbPediaParse(output) : { types : null , main_object : null };

                let useMainObject = (object) => {
                    let tags = _self.tagObj(object);
                    if(tags.length === 0) return false;
                    else return true;
                };

                dbPediaObj.main_object = (dbPediaObj.main_object && useMainObject(dbPediaObj.main_object)) ?
                    dbPediaObj.main_object : _obj.object;

                let sentiment = _self.getSentiment(_obj.speech, _obj.subject);
                let sentimentWords = (sentiment.score !== "neutral") ? sentiment[sentiment.score].words : [];
                let memory = _self.createMemoryObj( dbPediaObj , _obj , sentiment , sentimentWords );

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
                    _self.guesses[(_self.guessIndex-1)] = _self.removeEmptyKeysSetContextAndProps(memory, _self, _obj.tokens, _obj);
                }

                if (_self.guessIndex === _self.guesses.length) {
                    let results = _self.missingProperties(_self);

                    if (results.length > 0) {
                        _self.tokens$.next({
                            status: 'uncomplete',
                            results: results,
                            run: _self.run,
                            speech : _self.originalSpeech,
                            timestamp : moment().valueOf()
                        });
                    } else {
                        _self.tokens$.next({
                            status: 'completed',
                            results: _self.guesses,
                            run: _self.run,
                            speech : _self.originalSpeech,
                            timestamp : moment().valueOf()
                        });
                        _self.resetGuesses(_self);
                    }
                } else {
                    _self.doGuessProcess(_self.guesses[(_self.guessIndex)], _self, _self.guesses[(_self.guessIndex)].tokens);
                }
            });

        } else {
            // offline call mode
            let sentiment = _self.getSentiment(_obj.speech, _obj.subject);
            let sentimentWords = (sentiment.score !== "neutral") ? sentiment[sentiment.score].words : [];
            let memory = _self.createMemoryObj( { main_object: null, types: null } , _obj , sentiment , sentimentWords );
            let subject = speak.classify(_obj.speech).subject;

            memory.main_object = (subject) ? subject : _self.checkVerbForms(memory.action);

            // replace main_object with verb VBG if main_object and object are null
            if (memory.main_object === undefined) {
                memory.main_object = '';
            }

            // send response or create another guess
            if (_self.guesses.length > 0) {
                _self.guesses[(_self.guessIndex-1)] = _self.removeEmptyKeysSetContextAndProps(memory, _self, _obj.tokens, _obj);
            }

            if (_self.guessIndex === _self.guesses.length) {
                let results = _self.missingProperties(_self);

                if (results.length > 0) {
                    _self.tokens$.next({
                        status: 'uncomplete',
                        results: results,
                        run: _self.run,
                        speech : _self.originalSpeech,
                        timestamp : moment().valueOf()
                    });
                } else {
                    _self.tokens$.next({
                        status: 'completed',
                        results: _self.guesses,
                        run: _self.run,
                        speech : _self.originalSpeech,
                        timestamp : moment().valueOf()
                    });
                    _self.resetGuesses(_self);
                }
            } else {
                _self.doGuessProcess(_self.guesses[(_self.guessIndex)], _self, _self.guesses[(_self.guessIndex)].tokens);
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
     resetGuesses(_self) {
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
     removeEmptyKeysSetContextAndProps(memory, _self, _tokens, __obj__) {
        let new_context = (__obj__.new_context) ? __obj__.new_context : null;
        let sub_context = (__obj__.sub_context) ? __obj__.sub_context : null;

        let firstSetUniqueTags = _self.unique(memory, _self);
        let secondSetUniqueTags = _self.unique(memory, _self, firstSetUniqueTags);

        // get unique tags and set crud and state
        memory = Object.assign({},
            {
                crud: __obj__.crud,
                state: __obj__.state,
                tags: firstSetUniqueTags.concat(secondSetUniqueTags),
            },
            __obj__.extends ,
            memory
        );

        // remove state if no value. only needed for update crud mode
        if (memory.state === undefined) {
            memory.state = null;
        }

        /*
         * Overrides context if developer provides own implementation
         */
        // try to set context on contextFuncs
        if (_self.contextFuncs.length > 0) {
            let _memoryFunc = Object.assign({}, memory);
            let _main_object = _memoryFunc.main_object;

            delete _memoryFunc.main_object;
            delete _memoryFunc.context;

            _memoryFunc = Object.assign({},{ context: _main_object }, _memoryFunc);

            _self.contextFuncs
                .forEach(obj => {
                    let _context_ = null;

                    _self.contextes.forEach(_cont => {
                        if(obj.name === _cont.context) {
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
        let contextValue = (new_context === undefined || new_context === null) ? _self.mainContext : new_context;
        let subContextValue = (sub_context === new_context || sub_context === undefined || sub_context === null)
            ? '': sub_context;

        // set the crud value
        let crudValue = (memory.crud === "" || memory.crud === null) ? _self.mainCrud : memory.crud;

        // delete matches from tags to context or sub context
        memory.tags = memory.tags
            .reduce((acc, tag) => {
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
            memory = _self.formatMemory(memory, ['subject', 'action', 'object', 'interjection', 'tense',
                'is_question', 'question_type', 'sentiment', 'sentiment_words']);
        }

        // create mapping key
        let mappingKey = Object.keys(memory).reduce((acc, key) => {
            let contextMatch = false;

            _self.contextes.forEach(obj => {
                if (obj.context === memory.context && obj.hasOwnProperty('properties') ||
                    obj.context === contextValue && obj.hasOwnProperty('properties')) {
                    obj.properties.forEach(property => {
                        if (property.name === key) {
                            contextMatch = true;
                        }
                    });
                }
            });

            if (Array.isArray(memory[key]) && memory[key].length > 0 &&
                key !== 'tags' && contextMatch === true) {
                acc.push(key);
            }

            return acc;
        }, [])
        .concat([subContextValue, contextValue])
        .filter((value) => value !== undefined && value !== null && value !== '')
        .reverse()
        .join('_')
        .toLowerCase();

        return Object.assign({}, { context: contextValue, sub_context: subContextValue },
            memory, { crud: crudValue, mapping_key: mappingKey });
    }


    /**
     * Format the results to only return the request data
     *
     * @param {any} memory
     * @param {any} valuesToIgnore
     * @returns
     * @memberof Language
     */
    formatMemory(memory, valuesToIgnore = []) {
         return Object.keys(memory).reduce((acc, key) => {
                let _pos = valuesToIgnore;

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
    tagObj(str) {
        let tags = this.tagWords(str).tags;
        let patterns = ["NN","NNP","NNPS","NNS","VBG","JJ","JJR","JJS"];
        let entities = [];

        entities = tags.reduce((acc, tag) => {
            if(tag[0] !== SYSTEM_NAME) {
                if(patterns.includes(tag[1])) {
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
    dbPediaParse(output) {
        let results = output.response.Resources;
        let simScorePassOnePointOne = false;

        // get the similiarity score
        let similarityScores = () => {
            let scores = [];
            for(var r = 0; r < results.length; r++) {
                if(results[r]["@similarityScore"][0] === "1" || results[r]["@similarityScore"][0] === 1) {
                    scores = [r];
                    simScorePassOnePointOne = true
                    break;
                }
                else {
                    let score = Number(results[r]["@similarityScore"].replace("0.","").substring(0,5));
                    scores.push(score);
                }
            }
            return scores;
        };
        let scores = similarityScores();

        // get the index of the greatest similiarity score
        let index = (simScore) => {
            let scores = simScore;
            let ix = null;
            for(var i = 0; i < scores.length; i++) {
                if(scores[i] === Math.max(...scores)) {
                    ix = i;
                    break;
                }
            }
            return ix;
        };
        let idx = (simScorePassOnePointOne) ? scores[0] : index(scores);

        // get the types from pedia
        let types = () => {
            let uriRes = (results[idx].hasOwnProperty("@URI")) ? results[idx]["@URI"] : null;
            let uriType = (uri) => {
                if(uri) {
                    let uriBreak = uri.split("/");
                    return uriBreak[ uriBreak.length-1 ].toLowerCase();
                }
                else return "";
            };

            if(results[idx]["@types"] !== "" || results[idx]["@types"] === undefined) {
                let typeRemove = results[idx]["@types"].replace(/(DBpedia:|Schema:)/ig,"");
                let typeBreak = (typeRemove.match(",")) ? typeRemove.split(",") : [ typeRemove ];
                for(let tb = 0; tb < typeBreak.length; tb++) {
                    typeBreak[tb] = (typeBreak[tb].match("/")) ? uriType( typeBreak[tb] ) : typeBreak[tb].toLowerCase();
                }
                return typeBreak.concat( uriType( uriRes ) );
            }
            else return [ uriType( uriRes ) ];
        }
        types = types();

        // remove duplicate types if any
        let noDuplicateTypes = types.filter(function(elem, pos) {
            return types.indexOf(elem) == pos;
        });

        return { main_object : results[idx]["@surfaceForm"].toLowerCase() , types : noDuplicateTypes };
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
    getSentiment(str, subject) {
        let sentiment = speak.sentiment.analyze(str);

        let isNotOK = (str) => {
            let sent = "neutral";
            if(str.match("is ok") && subject.match( SYSTEM_NAME )) sent = "positive";
            else if(str.match("not ok") && subject.match( SYSTEM_NAME )) sent = "negative";
            return sent;
        }

        if(sentiment.comparative > 0) {
            let expr = /(don't|not|donot)+/ig;
            sentiment.score = (expr.test(str)) ? "negative" : "positive";
        }
        else if(sentiment.comparative < 0) {
            let expr = /(don't|not|donot)+/ig;
            sentiment.score = (expr.test(str)) ? "positive" : "negative";
        }
        else sentiment.score = isNotOK(str);

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
    createMemoryObj(dbPediaObj, obj, sentiment, sentimentWords) {
        return {
            context : obj.context,
            main_object : dbPediaObj.main_object,
            date: obj.dates,
            time: obj.times,
            person: obj.person,
            places: obj.places,
            phone : obj.phones,
            email : obj.emails,
            link : obj.links,
            file : obj.files,
            directory: obj.directories,
            number: obj.numbers,
            subject : obj.subject,
            action : obj.verbs,
            object : obj.object,
            interjection: obj.interjection,
            tense : obj.tense,
            is_question : obj.is_question,
            question_type: obj.question_type,
            sentiment : sentiment.score,
            sentiment_words : sentimentWords
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
    checkVerbForms(verbs) {
        if (verbs && verbs !== "") {
            let vrbs = (verbs.match(" ")) ? verbs.split(" ") : [verbs];
            let forms = nlp.verb(vrbs).conjugate();
            let gerund = "";

            if(forms) {

                Object.keys(forms).forEach(form => {
                    if(form === "gerund") {
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
    unique(pos, _self, _tags) {
        let tags = _self.tagObj(`${pos.context} ${pos.main_object} ${pos.object}`);

            tags = (_tags) ? Sugar.Array.remove(tags, (n) => {
                return _tags.filter(_tag => n === _tag).length > 0
            }) : tags;

            tags = Sugar.Array.most(tags, true);
            tags = Sugar.Array.unique(tags)
                .reduce((acc, _tag) => {
                    if(_tag.length > 2 && _tag !== undefined && _tag !== 'undefined' && _tag !== null) {
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
    getTimeFromSaying(tokensToStr) {
        let keepTimeFormat = false;
        let tense = null;
        let timePatterns = [
            ["this week", null],
            ["now", null],
            ["today", null],
            ["yesterday", false],
            ["tomorrow", true],
            ["next {0}", true],
            ["last {0}", false],
            ["{0} {1}", null],
            ["in an {0}", null],
            ["in a {0}", null],
            ["in {0} {1}", true],
            ["{0} {1} ago", false],
            ["the {0}{1}", null],
            ["next week {0}", true],
            ["last week {0}", false],
            ["the end of {0}", true],
            ["end of the day", true],
            ["end of the week", true],
            ["end of the month", true],
            ["end of the year", true],
            ["in half a year", true],
            ["in half an hour", true],
            ["half an hour ago", false],
            ["an {0} from now", true],
            ["a {0} from now", true],
            ["{0} {1} from now", true],
            ["{0} days from today", true],
            ["{0} weeks from today", true],
            ["the end of this day", true],
            ["the end of this week", true],
            ["the end of this month", true],
            ["the end of this year", true],
            ["beginning of the day", true],
            ["beginning of the week", true],
            ["beginning of the month", true],
            ["beginning of the year", true],
            ["the {0}{1} of {2}", null],
            ["the end of next {0}", true],
            ["the end of last {0}", false],
            ["the {0} day of {1}", null],
            ["{0} days after {1}", true],
            ["{0} weeks after {1}", true],
            ["{0} {1}{2} of last year", false],
            ["{0} {1}{2} of next year", true],
            ["{0} days after tomorrow", true],
            ["{0} weeks after tomorrow", true],
            ["the last day of {0}", true],
            ["the beginning of this day", true],
            ["the beginning of this week", true],
            ["the beginning of this month", true],
            ["the beginning of this year", true],
            ["the first {0} of {1}", true],
            ["the second {0} of {1}", true],
            ["the third {0} of {1}", true],
            ["the fourth {0} of {1}", true]
        ];

        // check oddie times exist
        let timeStr = timePatterns
            .reduce((acc, patterns) => {
                let pattern = patterns[0];

                // pattern to token string
                if(tokensToStr.includes(pattern)) {
                    acc = pattern;
                    tense = patterns[1];

                } else {
                    // handle days
                    times.days.forEach(day => {
                        let dayPattern = Sugar.String.format(pattern, day);

                        if (tokensToStr.includes(dayPattern)) {
                            acc = dayPattern;
                            tense = patterns[1];
                        }

                        if (pattern === "{0} days after {1}" || pattern === "{0} weeks after {1}") {
                            for ( let i = 1; i < 1000; i++) {
                                let numberDayPattern = Sugar.String.format(pattern, i, day);

                                if (tokensToStr.includes(numberDayPattern)) {
                                    acc = numberDayPattern;
                                    tense = patterns[1];
                                }
                            }

                            times.numbers_spelled.forEach(number => {
                                let numberDayPattern = Sugar.String.format(pattern, number, day);

                                if (tokensToStr.includes(numberDayPattern)) {
                                    acc = numberDayPattern;
                                    tense = patterns[1];
                                }
                            });
                        }

                        if( pattern === "the first {0} of {1}" ||
                            pattern === "the second {0} of {1}" ||
                            pattern === "the third {0} of {1}" ||
                            pattern === "the fourth {0} of {1}") {

                            times.months.forEach(month => {
                                let dayMonthPattern = Sugar.String.format(pattern, day, month);

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
                    times.months.forEach(month => {
                        let monthPattern = Sugar.String.format(pattern, month);

                        if (tokensToStr.includes(monthPattern)) {
                            acc = monthPattern;
                            tense = patterns[1];
                        }

                        if (pattern === "{0} {1}{2} of last year" || pattern === "{0} {1}{2} of next year" || pattern === "{0} {1}") {
                            times.date_endings.forEach(dateEnding => {
                                for (let i = 1; i < 32; i++) {
                                    let monthDatePattern = Sugar.String.format(pattern, month, i, dateEnding);

                                    if (tokensToStr.includes(monthDatePattern)) {
                                        acc = monthDatePattern;
                                        tense = patterns[1];
                                    }
                                }
                            });

                            for (let i = 1; i < 32; i++) {
                                let monthDatePattern = Sugar.String.format(pattern, i, month);

                                if (tokensToStr.includes(monthDatePattern)) {
                                    acc = monthDatePattern;
                                    tense = patterns[1];
                                }
                            }
                        }
                    });


                    // handle day times
                    times.day_times.forEach(time => {
                        let timeDayPattern = Sugar.String.format(pattern, time);

                        if (tokensToStr.includes(timeDayPattern)) {
                            acc = timeDayPattern;
                            tense = patterns[1];
                            if(time === 'second' || time === 'minute' || time === 'hour') {
                                keepTimeFormat = true;
                            }
                        }

                        if(pattern === "in {0} {1}" || pattern === "{0} {1} ago" || pattern === "{0} {1} from now") {
                            for ( let i = 1; i < 1000; i++) {
                                let sInTime = ( i > 1 ) ? time+'s' : time;
                                let timeNumberPattern = Sugar.String.format(pattern, i, sInTime);

                                if (tokensToStr.includes(timeNumberPattern)) {
                                    acc = timeNumberPattern;
                                    tense = patterns[1];
                                    if(time === 'second' || time === 'minute' || time === 'hour') {
                                        keepTimeFormat = true;
                                    }
                                }
                            }

                            let timeNumberPatternWithA = Sugar.String.format(pattern, 'a', time);
                            let timeNumberPatternWithAn = Sugar.String.format(pattern, 'a', time);

                            if (tokensToStr.includes(timeNumberPatternWithA) || tokensToStr.includes(timeNumberPatternWithAn)) {
                                acc = timeNumberPatternWithA;
                                tense = patterns[1];
                                if(time === 'second' || time === 'minute' || time === 'hour') {
                                    keepTimeFormat = true;
                                }
                            }
                        }
                    });

                    // handle weeks, months, and year times
                    times.times.forEach(time => {
                        let timeDayPattern = Sugar.String.format(pattern, time);

                        if (tokensToStr.includes(timeDayPattern)) {
                            acc = timeDayPattern;
                            tense = patterns[1];
                        }

                        if(pattern === "in {0} {1}" || pattern === "{0} {1} ago" || pattern === "{0} {1} from now") {
                            for ( let i = 1; i < 1000; i++) {
                                let timeNumberPattern = Sugar.String.format(pattern, i, time);

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

        if(timeStr) {
            let newTimeStr = (keepTimeFormat === true) ?
                Sugar.Date.format(new Date(Sugar.Date.create(timeStr)), '{do} {month} {yyyy} {hh}:{mm} {tt}') :
                Sugar.Date.format(new Date(Sugar.Date.create(timeStr)), '{do} {month} {yyyy}');
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
     missingProperties(_self) {
        return _self.guesses.reduce((acc, obj) => {
            if (obj.context) {
                let _responses = _self.contextes.reduce((_acc, _context) => {
                    if (obj.context === _context.context) {
                        if (_context.hasOwnProperty('properties') && _context.properties.length > 0) {

                            _context.properties.forEach(property => {
                                let hasPropertyInExtends = false;

                                _self.extends.forEach((extObj) => {
                                    if (extObj.name === property.name || _self.baseProperties.includes(property.name)) {
                                        hasPropertyInExtends = true;
                                    }
                                })

                                if (hasPropertyInExtends) {
                                    if (!Object.keys(obj).includes(property.name) ||
                                        Object.keys(obj).includes(property.name) && obj[property.name].length === 0) {
                                        let _response = _self.generateResponseForMissingProperty(property);

                                        _self.properties.push(property.name);
                                        _acc.push(_response);
                                    }
                                } else {
                                    throw new Error(`Armis Error: Property '${property.name}' must have an extended method!`);
                                }
                            });
                        }
                    }

                    return _acc;
                }, []);

                if (_responses.length > 0) {
                    var randomResponse = responses.random[Math.floor(Math.random()*responses.random.length)];

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
    generateResponseForMissingProperty(property) {
        if (property.hasOwnProperty('noun') && property.hasOwnProperty('multi') && property.multi === true) {
            return Sugar.String.format(responses[property.noun], property.name, 's', 'are');
        } else if (property.hasOwnProperty('noun')) {
            return Sugar.String.format(responses[property.noun], property.name, '', 'is');
        } else {
            throw new Error(`
             Armis Error: property object missing 'noun' key
             (Ex: { name: 'A Name', noun: 'person' | 'place' | 'thing'})
            `);
        }
    }
}
