"use strict";

var simplesmtp = require("simplesmtp"),
    createDirectmailer = require("../index"),
    PORT_NUMBER = 8397;

exports["General tests"] = {
    setUp: function (callback) {
        this.server = new simplesmtp.createServer({
            disableDNSValidation: true
        });
        this.server.listen(PORT_NUMBER, function(err){
            if(err){
                throw err;
            }else{
                callback();
            }
        });

    },

    tearDown: function (callback) {
        this.server.end(callback);
    },

    "Create directmailer instance": function(test){
        var mailer = createDirectmailer();
        test.ok(mailer.send);
        test.done();
    },

    "Send mail": function(test){
        var mailer = createDirectmailer({
            debug: false,
            port: PORT_NUMBER
        });

        var mail = mailer.send({
            from: "andris@example.com",
            recipients: "andris@127.0.0.1",
            message: "Subject: test\r\n\r\nTest!"
        });

        mail.once("failed", function(){
            test.ok(false);
            test.done();
        });

        mail.once("sent", function(data){
            test.equal(data.domain, "127.0.0.1");
            test.ok(/^250\D/.test(data.response));
            test.done();
        });
    }
};