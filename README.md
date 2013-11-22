# DirectMail

Sendmail alternative to send e-mails directly to recipients without a relaying service.

## Usage

Require *directmail* object

    var directmail = require("directmail");

And push a message to the outgoing queue

    directmail({
        from: "sender@example.com",
        recipients: ["receiver1@example.com", "receiver2@example.com"],
        message: "Subject: test\r\n\r\nHello world!",
        debug: false
    });

Where

  * **from** (string) is the e-mail address of the sender
  * **recipients** (array) is an array of recipient e-mails. Put all `to`, `cc` and `bcc` addresses here.
  * **message** (string|buffer) is the RFC2822 message to be sent
  * **debug** (boolean) if set to true, all data about queue processing is printed to console

*Directmail* is very inefficient as it queues all e-mails to be sent into memory. Additionally, if a message is not yet sent and the process is closed, all data about queued messages are lost. Thus *directmail* is only suitable for low throughput systems, like password remainders and such, where the message can be processed immediatelly. *Directmail* is not suitable for spamming.

While being not 100% reliable, *directmail* can still handle sending errors, graylisting and such. If a message can not be sent, it is requeued and retried later.

## License

**MIT**

