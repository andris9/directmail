"use strict";

var createQueue = require("./queue"),
    simplesmtp = require("simplesmtp"),
    dns = require("dns");

var directMailer = {

    _queue: createQueue(),
    _started: false,
    _lastId: 0,

    send: function(options){
        options = options || {};

        var from = [].concat(options.from || []).shift() || "",
            recipients = [].concat(options.recipients || []),
            message = options.message || "",
            domainGroups = {};

        if(!from){
            throw new Error("'From' address missing");
        }

        if(!recipients.length){
            throw new Error("'Recipients' addresses missing");
        }

        if(!message){
            throw new Error("Nothing to send, 'message' empty");
        }

        recipients.forEach(function(recipient){
            recipient = (recipient || "").toString();

            var domain = (recipient.split("@").pop() || "").toLowerCase().trim();

            if(!domainGroups[domain]){
                domainGroups[domain] = [recipient];
            }else if(domainGroups[domain].indexOf(recipient) < 0){
                domainGroups[domain].push(recipient);
            }
        });

        Object.keys(domainGroups).forEach((function(domain){
            this._queue.insert({
                from: from,
                to: domainGroups[domain],
                domain: domain,
                message: message,
                debug: !!options.debug,
                id: ++this._lastId
            });
            if(options.debug){
                console.log("Queued message #%s from %s, to %s", this._lastId, from, domainGroups[domain].join(", "));
            }
        }).bind(this));

        // start send loop if needed
        if(!this._started){
            this._started = true;
            this._loop();
        }

        return true;
    },

    _loop: function(){
        this._queue.get((function(data){

            if(data.debug){
                console.log("Retrieved message #%s from the queue, reolving %s", data.id, data.domain);
            }

            dns.resolveMx(data.domain, (function(err, list){
                if(data.debug){
                    if(err){
                        console.log("Resolving %s for #%s failed", data.domain, data.id);
                        console.log(err);
                    }else if(!list || !list.length){
                        console.log("Could not resolve any MX servers for %s", data.domain);
                    }
                }
                if(err || !list || !list.length){
                    data.replies = (data.replies || 0) + 1;
                    if(data.replies <= 5){
                        this._queue.insert(data, data.replies * 60 * 1000);
                        if(data.debug){
                            console.log("Message #%s requeued for %s minutes", data.id, data.replies);
                        }
                    }
                    if(typeof setImmediate == "function"){
                        setImmediate(this._loop.bind(this));
                    }else{
                        process.nextTick(this._loop.bind(this));
                    }
                    return;
                }

                list.sort(function(a, b){
                    return (a && a.priority || 0) - (b && b.priority || 0);
                });

                var exchange = list[0] && list[0].exchange;

                if(data.debug){
                    console.log("%s resolved to %s for #%s", data.domain, exchange, data.id);
                }

                this._process(exchange, data, (function(err, response){
                    if(data.debug){
                        if(err){
                            console.log("Failed processing message #");
                        }else{
                            console.log("Server responded for #%s:", data.id);
                            console.log(response);
                        }
                    }
                    if(err){
                        data.replies = (data.replies || 0) + 1;
                        if(data.replies <= 5){
                            this._queue.insert(data, data.replies * 15 * 60 * 1000);
                            if(data.debug){
                                console.log("Message #%s requeued for %s minutes", data.id, data.replies * 15);
                            }
                        }
                    }
                    if(typeof setImmediate == "function"){
                        setImmediate(this._loop.bind(this));
                    }else{
                        process.nextTick(this._loop.bind(this));
                    }
                }).bind(this));

            }).bind(this));

        }).bind(this));
    },

    _process: function(exchange, data, callback){
        if(data.debug){
            console.log("Connecting to %s:25 for message #%s", exchange, data.id);
        }

        var client = simplesmtp.connect(25, exchange, {ignoreTLS: true, debug: data.debug}),
            response = {},
            ready = false;

        client.once("idle", function(){
            client.useEnvelope({
                from: data.from,
                to: data.to
            });
        });

        client.once("rcptFailed", function(addresses){
            if(data.debug){
                console.log("The following addresses were rejected for #%s: %s", data.id, addresses.join(", "));
            }
        });

        client.once("message", function(){
            if(data.debug){
                console.log("Transmitting message #%s", data.id);
            }
            client.end(data.message);
        });

        client.once("ready", function(success, message){
            response.success = !!success;
            response.message = message;
            client.quit();
        });

        client.once("error", function(err){
            if(ready){
                return;
            }
            ready = true;
            callback(err);
        });

        client.once("end", function(){
            if(ready){
                return;
            }
            ready = true;

            if(!response.success){
                callback(new Error("Sending failed with error " + (response.message || "").substr(0, 3)));
            }else{
                callback(null, response.message);
            }
        });
    }
};

module.exports = directMailer.send.bind(directMailer);
