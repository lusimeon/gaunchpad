#!/usr/bin/env node

"use strict";
const Launchpad = require( "launchpad-mini" ),
      pad = new Launchpad(),
      gh = require( "gh-scrape" ),
      dateUtils = require( "date-utils" ),
      program = require( "commander" ),
      request = require("request");

const today = Date.today(),
      numberDays = 56,
      numberRows = 7;

let err = null;

let tmpNumberDays = numberDays - (7 - today.getDay());

const firstDay = today.clone().removeDays(tmpNumberDays);

const levelSteps = {
    min : 1,
    mid : 4,
    max : 7
}

const levelColors = {
    min : pad.green.low,
    mid : pad.green.medium,
    max : pad.green.full,
    disabled : pad.red.low
}

let usernameIsValid = (url, callback) => {
    let isValid = false
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            isValid = true;
        }
        
        if ( callback !== undefined ) {
            callback( isValid );
        }
    });
}

let getValidContributions = ( userUrl, callback ) => {
    let validContributions = [];
    gh.scrapeContributionDataAndStats( userUrl, (data) => {
        if ( data ) {
            let contributions = data.contributionData;

            for ( let i = 0; i < contributions.length; i++ ) {
                let contribution = contributions[i];

                if ( contribution.dataDate !== undefined ) {
                    let contributionDate = new Date( contribution.dataDate ),
                        contributionCount = contribution.dataContributionCount;

                    let contributionLevel = ( contributionCount >= levelSteps.min ) ? ( contributionCount >= levelSteps.mid ) ? ( contributionCount >= levelSteps.max ) ? 3 : 2 : 1 : 0;

                    if ( contributionDate.between( firstDay, today ) ) {
                        contribution.level = contributionLevel;
                        validContributions.push( {
                            "date" : contributionDate.clone(),
                            "level" : contribution.level 
                        } );
                    }
                }
            };
        }

        if ( callback !== undefined ) {
            callback( validContributions );
        }
    });
};

let setGrid = ( allContributions ) => {
    pad.connect().then( () => {     
        pad.reset();
        pad.flash = false;

        for (var n = 0; n < allContributions.length; n++) {
            let contribution = allContributions[n];

            let row = (n + 1) % numberRows;
            let col = Math.floor( ( n + 1 ) / numberRows );

            if (row !== 0) {
                col = col + 1;
            } else {
                row = numberRows;
            }

            row = row - 1;
            col = col - 1;

            contribution.color = ( contribution.level === 3 ) ? levelColors.max : ( contribution.level === 2 ) ? levelColors.mid : ( contribution.level === 1 ) ? levelColors.min : ( contribution.level === 0 ) ? pad.off : levelColors.disabled;

            pad.col( contribution.color, [ [col, row] ]);
        };
        
        // Disable last row
        pad.col( levelColors.disabled, pad.fromMap(
            '--------o' +
            '--------o' +
            '--------o' +
            '--------o' +
            '--------o' +
            '--------o' +
            '--------o' +
            'xxxxxxxxo' +
            'oooooooo '
        ) );

    } );
}

let gaunchpad = (username) => {
    if (username !== undefined && username !== null) {
        let userUrl = "http://github.com/" + username;
        usernameIsValid( userUrl, (isValid)  => {
            if ( isValid !== undefined && isValid === true ) {
                getValidContributions( userUrl, ( validContributions ) => {
                    if ( validContributions !== null ) {
                        let allContributions = [];
                        let tmpAllContributions = [];
                        let tmpDay = today.clone().clearUTCTime();

                        for (var i = 0; i < numberDays; i++) {
                            if ( tmpDay.isAfter( firstDay ) ) {
                                let tmpContribution = [];

                                let defaultContribution = {
                                    "date" : tmpDay.clone(),
                                    "level" : 0
                                };

                                tmpContribution = validContributions.filter( ( obj ) => {
                                    if ( Date.equals( obj.date, tmpDay ) ) {
                                        return true;
                                    } else {
                                        return false;
                                    }
                                });

                                if ( tmpContribution.length > 0 ) {
                                    allContributions.push( tmpContribution[0] );
                                } else {
                                    allContributions.push( defaultContribution );
                                }
                            } else {
                                tmpAllContributions.push( {
                                    "date" : null,
                                    "level" : null
                                } );
                            }

                            tmpDay.removeDays(1);
                        };

                        allContributions.reverse();
                        allContributions = allContributions.concat(tmpAllContributions);

                        setGrid( allContributions );
                    }
                });
            } else {
                console.log("User profile does not exist");
                process.exit(1);
            }
        });
    } else {
        console.log("Empty username argument");
        process.exit(1);
    }
};

program
    .arguments( "<username>" )
    .action( (username) => {
        gaunchpad(username);
    } )
    .parse(process.argv);

process.on( "SIGINT", function() {
    if ( err !== undefined && err !== null ) {
        console.log( err );
        process.exit(1);
    } else {
        pad.reset();
        process.exit(0);
    }
});