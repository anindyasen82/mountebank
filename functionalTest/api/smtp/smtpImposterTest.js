'use strict';

var assert = require('assert'),
    api = require('../api'),
    client = require('./smtpClient'),
    promiseIt = require('../../testHelpers').promiseIt,
    port = api.port + 1,
    timeout = parseInt(process.env.MB_SLOW_TEST_TIMEOUT || 2000);

describe('smtp imposter', function () {
    this.timeout(timeout);

    describe('POST /imposters/:id', function () {
        promiseIt('should auto-assign port if port not provided', function () {
            var request = { protocol: 'smtp', name: this.name };

            return api.post('/imposters', request).then(function (response) {
                assert.strictEqual(response.statusCode, 201);
                assert.ok(response.body.port > 0);
            }).finally(function () {
                return api.del('/imposters');
            });
        });
    });

    describe('GET /imposters/:id', function () {
        promiseIt('should provide access to all requests', function () {
            var imposterRequest = { protocol: 'smtp', port: port, name: this.name };

            return api.post('/imposters', imposterRequest).then(function () {
                return client.send({
                    envelopeFrom: 'envelopeFrom1@mb.org',
                    envelopeTo: ['envelopeTo1@mb.org'],
                    from: '"From 1" <from1@mb.org>',
                    to: ['"To 1" <to1@mb.org>'],
                    subject: 'subject 1',
                    text: 'text 1'
                }, port);
            }).then(function () {
                return client.send({
                    envelopeFrom: 'envelopeFrom2@mb.org',
                    envelopeTo: ['envelopeTo2@mb.org'],
                    from: '"From 2" <from2@mb.org>',
                    to: ['"To 2" <to2@mb.org>'],
                    subject: 'subject 2',
                    text: 'text 2'
                }, port);
            }).then(function () {
                return api.get('/imposters/' + port);
            }).then(function (response) {
                var requests = response.body.requests;
                requests.forEach(function (request) {
                    if (request.requestFrom) {
                        request.requestFrom = 'HERE';
                    }
                    if (request.timestamp) {
                        request.timestamp = 'NOW';
                    }
                });
                assert.deepEqual(requests, [
                    {
                        timestamp: 'NOW',
                        requestFrom: 'HERE',
                        envelopeFrom: 'envelopeFrom1@mb.org',
                        envelopeTo: ['envelopeTo1@mb.org'],
                        from: { address: 'from1@mb.org', name: 'From 1' },
                        to: [{ address: 'to1@mb.org', name: 'To 1' }],
                        cc: [],
                        bcc: [],
                        subject: 'subject 1',
                        priority: 'normal',
                        references: [],
                        inReplyTo: [],
                        text: 'text 1',
                        html: '',
                        attachments: []
                    },
                    {
                        timestamp: 'NOW',
                        requestFrom: 'HERE',
                        envelopeFrom: 'envelopeFrom2@mb.org',
                        envelopeTo: ['envelopeTo2@mb.org'],
                        from: { address: 'from2@mb.org', name: 'From 2' },
                        to: [{ address: 'to2@mb.org', name: 'To 2' }],
                        cc: [],
                        bcc: [],
                        subject: 'subject 2',
                        priority: 'normal',
                        references: [],
                        inReplyTo: [],
                        text: 'text 2',
                        html: '',
                        attachments: []
                    }
                ]);
            }).finally(function () {
                return api.del('/imposters');
            });
        });
    });

    describe('DELETE /imposters/:id should shutdown server at that port', function () {
        promiseIt('should shutdown server at that port', function () {
            var request = { protocol: 'smtp', port: port, name: this.name };

            return api.post('/imposters', request).then(function (response) {
                return api.del(response.headers.location);
            }).then(function (response) {
                assert.strictEqual(response.statusCode, 200, JSON.stringify(response.body));

                return api.post('/imposters', request);
            }).then(function (response) {
                assert.strictEqual(response.statusCode, 201, 'Delete did not free up port');
            }).finally(function () {
                return api.del('/imposters/' + port);
            });
        });
    });
});
