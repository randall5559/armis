
<div>
    <span>
         <img align="left" width="45" height="45" src="https://raw.githubusercontent.com/randall5559/armis/master/assets/logo.png" />
        <h1><sub>A.R.M.I.S. - <i>a rather mini intelligent system</i></sub></h1>
    </span>
</div>

#### Table of Contents

[Introduction](https://github.com/randall5559/armis#introduction)

[Setup Armis](https://github.com/randall5559/armis#setup-armis)

[Documentation](https://github.com/randall5559/armis#documentation-for-armis-module)

[See Example]()




## Introduction

Armis is a NLP (Natural Language Processing) system that takes plain english
and breaks it apart into a consumable/mappable structure that can be used with
other systems/protocols (REST, GraphQL, Firebase, LocalStorage, IoT, IFTTT, etc.)


## Setup Armis

#### the Yarn way (recommended)

1. [Install Yarn](https://yarnpkg.com/lang/en/docs/install/)
2. Download and extract
3. Run ```yarn add https://github.com/randall5559/armis.git```
4. Run ```yarn start``` to start app

#### the Node way

1. [Install Node.js](https://nodejs.org/en/download/)
2. Download and extract
3. Run ```npm install https://github.com/randall5559/armis.git```
4. Run `npm start` to start app


## Documentation for Armis module

#### Instantiate Armis with a context schema (used to refine your results)

```javascript
// @param context_schema - Refine the return payload (recommended for better mapping to DB)
// context_schema can be an javascript array of contextes passed as a parameter or
// a absolute path from the root app directory to an json file containing an array of contextes.

// @param return_format[optional] - The option of returning all, just the data with values or
// values with part-of-speech ( 'values' | 'values-and-pos' | 'all' )
// 'values' is set by default.

// @param context_time[optional] - Set the time for Armis to persist a context in seconds.
// by default Armis will maintain a context for 10 seconds before reseting state back to start.

var armis = new Armis(
    [context_schema | 'path_to_context_schema_MUST_BE_AN_ABSOLUTE_PATH_FROM_APP_ROOT_DIR'],
    [return_format | context_time], [context_time]
);
```


#### Context schema example


```javascript
[
    {
        // Main context for matching
        context: 'house',

        // Tags to match to main context if found on a query string then the main context object is returned
        tags: ['home', 'basement', 'backyard', 'kitchen', 'bathroom'],

        // Sub context to match. If a sub context tag is found on query string then the main context object is returned
        sub_context: [
            {
                context: 'garage',
                tags: ['car','tools'] // Tags to match to sub context
            }
        ],

        // If query string contains any of the provide tags this main context will not be returned.
        // Even if provided tags for main context and sub context have matches it will still be ignored
        ignores: [ 'oven', 'refrigerator', 'fridge' ]

        // If query string contains any of the provide tags plus a main context tag or sub context tag
        // this context will be returned.
        requires: ['door']

        // An array of properties that must be found on the query string in order for a main context to be returned
        // each property must also have an extend method associated with the name if it's not one of
        // Armis core properties (date, time, phone, email, link, file, directory, number, person).
        // See below extend method documentation.
        properties: [
            {
                name: 'color', // name of the property
                noun: 'thing', // the property as a noun (person, place or thing)
                multi: true // allow multiple params (in this case multi colors)
            }
        ]
    }
]
```


#### Armis query results example
```javascript
{
    // Status of the results [ completed, uncompleted ]
    "status": "completed",

    // The results with break downs
    "results": [
        {
            "context": "house",
            "sub_context": "garage",
            "crud": "read",
            "state": null,
            "tags": [
                "door"
            ],

            // Core properties (remember you can extend these with extend())
            "date": [],
            "time": [],
            "person": [],
            "places": [],
            "phone": [],
            "email": [],
            "link": [],
            "file": [],
            "directory": [],
            "number": [],

            // Part of Speech
            "subject": "",
            "action": "",
            "object": "",
            "interjection": [],
            "tense": "present",
            "is_question": false,
            "question_type": "",
            "sentiment": "neutral",
            "sentiment_words": [],

            // Mapping key
            "mapping_key": "house_garage"
        }
    ],

    // The 'run' is either 'join' | 'individual' | ''.
    // A 'join' run is two or more matched contexts from the results that have a relationship
    // Ex: 'Login out bob then cancel his account'. This query would be one after the other thus 'join'
    // would be the value
    // A individual is to separate contextes that could be run in parallel or not. They have no relationship
    "run": "",

    // The query that was sent to Armis
    "speech": "is bob logged in",

    // When the query was ran
    "timestamp": 1503162521443
}
```

#### Armis query results example with required properties not fulfilled

```javascript
{
    "status": "uncomplete",
    "results": [
        {
            "context": "user",
            "sub_context": "",
            "responses": [
                "Who is the person",
                "I don't understand"
            ]
        }
    ],
    "run": "individual",
    "speech": "is logged in",
    "timestamp": 1503163795198
}
```


#### Get a context from the context schema

```javascript
armis.getContext('house');
```


#### Remove a context from the context schema

```javascript
armis.removeContext('house');
```


#### Add a context to the context schema

```javascript
armis.addContext({
    context: 'shop',
    tags: ['deli', 'pharmarcy', 'frozen'],
    sub_context: [{
        context: 'fruits_n_vegetables',
        tags: ['fruit', 'vegetable']
    }],
    properties: [
        {
            name: 'clothes',
            noun: 'thing'
        }
    ]
});
```


#### Override armis context method that runs when a context is matched.

```javascript
// must return a boolean
armis.context('house', (contextObj, raw) => {
    console.log('print raw text', raw);

    if (contextObj.tags.includes('color')) {
        return true;
    }
});
```


#### Extend armis core properties (date, time, phone, email, link, file, directory, number, people):


```javascript
// must return an array
armis.extend('color', (tokens) => {
    let colors = ['black', 'white', 'yellow', 'green', 'orange', 'pink', 'blue'];
    return colors.filter(color => tokens.includes(color));
});
```


#### Publish a query for Armis to consume by using the guess() method.

```javascript
armis.guess('query-string', 'passParam (func | string | objects | array | number)');
```


#### Return matched context, POS, and other details from the published guess() method query

```javascript
// listen for published guesses and return results
armis.on('guesses', (result, passParam) => {
    console.log(result);
});
```


#### Handle guess query errors if any

```javascript
// handle error while processing published guesses
armis.on('error', (error, passParam) => {
    console.log(error);
});
```


#### destroy() all context, subscribes, etc. and start at initial state

```javascript
armis.destroy();
```


## Armis N Play Example

#### Who's logged in example with a required property
````javascript
// Example context. Must have a property of name with value(s) in order to make a context match
[
    {
        context: 'user',
        sub_context: [{
            context: 'login',
            tags: ['logged']
        }],
        properties: [
            {
                name: 'person',
            }
        ]
    }
]

// The query called
armis.guess('Is Bob logged in?', '');

// The json response
{
    "status": "completed",
    "results": [
        {
            "context": "user",
            "sub_context": "login",
            "crud": "read",
            "state": null,
            "tags": [
                "bob"
            ],
            "person": [
                "bob"
            ],
            "mapping_key": "user_login_people"
        }
    ],
    "run": "",
    "speech": "is bob logged in",
    "timestamp": 1503162521443
}
````


#### Who's logged in/out example with a requires key
````javascript
// Example context. The below context says that the query string must contain the token 'now'
// in order to continue processing the query. This becomes important when dealing with multiple contexts using
// the same context main tag. Look at below example.
[
     {
        context: 'user',
        sub_context: [{
            context: 'loggedOut',
            tags: ['logged']
        }],
        properties: [
            {
                name: 'person',
            }
        ]
        requires: ['out']
    },
    {
        context: 'user',
        sub_context: [{
            context: 'loggedIn',
            tags: ['logged']
        }],
        properties: [
            {
                name: 'person',
            }
        ],
        requires: ['in']
    }
]

// You could also do

[
     {
        context: 'user',
        sub_context: [{
            context: 'loggedIn',
            tags: ['in']
        },
        {
            context: 'loggedOut',
            tags: ['out']
        }],
        properties: [
            {
                name: 'person',
            }
        ]
        requires: ['logged']
    }
]

// The query called
armis.guess('Is Bob logged in now?', '');

// The json response
{
    "status": "completed",
    "results": [
        {
            "context": "user",
            "sub_context": "loggedIn",
            "crud": "read",
            "state": null,
            "tags": [
                "bob"
            ],
            "person": [
                "bob"
            ],
            "mapping_key": "user_loggedin_person"
        }
    ],
    "run": "",
    "speech": "is bob logged in",
    "timestamp": 1503162521443
}
````


#### Many Contextes Example
##### Note: Armis Contextes is a first in first serve concept. Meaning when setting your context make sure the more fine tune context is higher up with multiple contextes of the same name

````javascript
[
    {
        context: 'user',
        sub_context: [{
            context: 'login',
            tags: ['logged']
        }],
        properties: [
            {
                name: 'people',
            }
        ]
    },
    {
        context: 'user',
        sub_context: [{
            context: 'created',
            tags: ['made', 'started', 'added']
        }]
    },
    {
        context: 'user'
    }
]
````
