"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const __1 = require("..");
const FormConnection_1 = require("./helpers/FormConnection");
const __2 = require("..");
const URI = require("urijs");
const __3 = require("..");
const __4 = require("..");
const __5 = require("..");
const puppeteer = require("puppeteer");
chai_1.use(require('chai-string'));
const method = 'POST';
const signatureKeyId = 'testKey';
const signatureSecret = 'testSecret';
const account = 'test';
const merchant = 'test_merchantId';
const baseUrl = 'https://v1-hub-staging.sph-test-solinor.com';
const successUrl = 'https://example.com/success';
const failureUrl = 'https://example.com/failure';
const cancelUrl = 'https://example.com/cancel';
const language = 'EN';
const amount = 9999;
const currency = 'EUR';
const orderId = '1000123A';
const description = 'order description';
const sphAccount = 'test';
const sphMerchant = 'test_merchantId';
const webhookSuccessUrl = 'http://example.com/?q=success';
const webhookFailureUrl = 'http://example.com/?q=failure';
const webhookCancelUrl = 'http://example.com/?q=cancel';
const webhookDelay = 0;
let formBuilder;
let ss;
let cardToken;
beforeEach(() => {
    ss = new __3.SecureSigner(signatureKeyId, signatureSecret);
    formBuilder = new __1.FormBuilder(method, signatureKeyId, signatureSecret, account, merchant, baseUrl);
});
function testRedirectResponse(response, locationEndsWith) {
    chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
    chai_1.assert.endsWith(response.headers.location, locationEndsWith, 'Response should return location to form.');
}
function testNameValuePairs(nameValuePairs, rightAmount) {
    chai_1.assert(nameValuePairs.length === rightAmount, 'Should have ' + rightAmount + ' name value pairs. Got ' + nameValuePairs.length);
}
function testWebhookNameValuePairs(nameValuePairs, skipDelayTest) {
    const testSuccessUrl = nameValuePairs.find((x) => x.first === 'sph-webhook-success-url').second;
    chai_1.assert(testSuccessUrl === webhookSuccessUrl, 'sph-webhook-success-url should be ' + webhookSuccessUrl + 'got ' + testSuccessUrl);
    const testFailureUrl = nameValuePairs.find((x) => x.first === 'sph-webhook-failure-url').second;
    chai_1.assert(testFailureUrl === webhookFailureUrl, 'sph-webhook-failure-url should be ' + webhookFailureUrl + 'got ' + testFailureUrl);
    const testCancelUrl = nameValuePairs.find((x) => x.first === 'sph-webhook-cancel-url').second;
    chai_1.assert(testCancelUrl === webhookCancelUrl, 'sph-webhook-cancel-url should be ' + webhookCancelUrl + 'got ' + testCancelUrl);
    if (typeof skipDelayTest === 'undefined') {
        const testDelay = nameValuePairs.find((x) => x.first === 'sph-webhook-delay').second;
        chai_1.assert(testDelay === webhookDelay.toString(), 'sph-webhook-delay should be ' + webhookDelay + 'got ' + testDelay);
    }
}
function assertNameValuePair(nameValuePairs, key, value) {
    const element = nameValuePairs.find((pair) => {
        return pair.first === key;
    });
    chai_1.assert(element.second === value);
}
describe('Form builder', () => {
    it('Should have instance of FormBuilder', () => {
        chai_1.assert.instanceOf(formBuilder, __1.FormBuilder, 'Was not instance of FormBuilder');
    });
    it('Should have right parameters', () => {
        const formContainer = formBuilder.generateAddCardParameters(successUrl, failureUrl, cancelUrl, language);
        testNameValuePairs(formContainer.nameValuePairs, 10);
        chai_1.assert(formContainer.getAction() === baseUrl + '/form/view/add_card', 'Action url should be ' + baseUrl + '/form/view/add_card' +
            ' got ' + formContainer.getAction());
    });
    it('Test tokenize', (done) => {
        const formContainer = formBuilder.generateAddCardParameters(successUrl, failureUrl, cancelUrl, language);
        const paymentAPI = new __2.PaymentAPI(baseUrl, signatureKeyId, signatureSecret, sphAccount, sphMerchant);
        FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
            return puppeteer
                .launch({ args: ['--no-sandbox'] })
                .then((browser) => {
                return browser.newPage().then((page) => {
                    return page
                        .goto(baseUrl + response.headers.location)
                        .then(() => page.type('input[name=card_number_formatted]', '4153 0139 9970 0024'))
                        .then(() => page.type('input[name=expiry]', '11 / 23'))
                        .then(() => page.type('input[name=cvv]', '024'))
                        .then(() => page.screenshot({ path: 'example.png' }))
                        .then(() => page.setRequestInterception(true))
                        .then(() => {
                        // required for page.click and returning non 404
                        page.on('request', (request) => {
                            if (!request.url().startsWith('https://example.com')) {
                                return request.continue();
                            }
                            else {
                                return request.respond({
                                    status: 200,
                                    contentType: 'text/plain',
                                    body: ''
                                });
                            }
                        });
                        return Promise
                            .all([
                            page.waitForResponse(response => {
                                return response.status() === 200; // will continue after redirects
                            }).then(response => {
                                chai_1.assert.isTrue(response.request().url().startsWith('https://example.com'), 'Final response url was not example.com');
                                const uri = URI.parse(response.request().url());
                                const parameters = URI.parseQuery(uri.query);
                                chai_1.assert.isTrue(ss.validateFormRedirect(parameters), 'Validate redirect should return true');
                                return paymentAPI
                                    .tokenization(parameters['sph-tokenization-id'])
                                    .then((tokenResponse) => {
                                    chai_1.assert(tokenResponse.card.expire_year === '2023', 'Expire year should be 2023');
                                    chai_1.assert(tokenResponse.card.expire_month === '11', 'Expire month should be 11');
                                    chai_1.assert(tokenResponse.card.type === 'Visa', 'Card type should be Visa');
                                    chai_1.assert(tokenResponse.card.cvc_required === 'no', 'Should not require CVC');
                                    cardToken = tokenResponse.card_token;
                                });
                            }),
                            page.click('button[type=submit]')
                        ]);
                    });
                }).then(() => {
                    return browser.close();
                }, error => {
                    return browser.close().then(() => chai_1.assert.ifError(error));
                });
            });
        })
            .then(_ => { done(); }, error => {
            done(error);
        });
    });
    it('Test with acceptCvcRequired set to false.', () => {
        const acceptCvcRequired = false;
        const formContainer = formBuilder.generateAddCardParameters(successUrl, failureUrl, cancelUrl, language, acceptCvcRequired);
        const signature = formContainer.nameValuePairs.find((x) => x.first === 'signature');
        chai_1.assert.isNotNull(signature, 'Form signature should not be null');
        chai_1.assert.startsWith(signature.second, 'SPH1', 'Signature should start with "SPH1"');
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/tokenize');
        });
    });
    it('Test with acceptCvcRequired set to true.', () => {
        const acceptCvcRequired = false;
        const formContainer = formBuilder.generateAddCardParameters(successUrl, failureUrl, cancelUrl, language, acceptCvcRequired);
        const signature = formContainer.nameValuePairs.find((x) => x.first === 'signature');
        chai_1.assert.isNotNull(signature, 'Form signature should not be null');
        chai_1.assert.startsWith(signature.second, 'SPH1', 'Signature should start with "SPH1"');
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/tokenize');
        });
    });
    it('Test add card with all parameters', () => {
        const acceptCvcRequired = true;
        const skipFormNotifications = true;
        const exitIframeOnResult = true;
        const exitIframeOn3ds = true;
        const use3ds = true;
        const formContainer = formBuilder.generateAddCardParameters(successUrl, failureUrl, cancelUrl, language, acceptCvcRequired, skipFormNotifications, exitIframeOnResult, exitIframeOn3ds, use3ds);
        testNameValuePairs(formContainer.nameValuePairs, 15);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/tokenize');
        });
    });
    it('Test add card with only 3ds', () => {
        const acceptCvcRequired = undefined;
        const skipFormNotifications = undefined;
        const exitIframeOnResult = undefined;
        const exitIframeOn3ds = undefined;
        const use3ds = true;
        const formContainer = formBuilder.generateAddCardParameters(successUrl, failureUrl, cancelUrl, language, acceptCvcRequired, skipFormNotifications, exitIframeOnResult, exitIframeOn3ds, use3ds);
        testNameValuePairs(formContainer.nameValuePairs, 11);
        chai_1.assert(formContainer.nameValuePairs.find((x) => x.first === 'sph-use-three-d-secure').second === 'true', 'sph-use-three-d-secure should be true');
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/tokenize');
        });
    });
    it('Test mandatory payment parameters ', () => {
        const formContainer = formBuilder.generatePaymentParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description);
        testNameValuePairs(formContainer.nameValuePairs, 14);
        chai_1.assert(formContainer.nameValuePairs.find((x) => x.first === 'description').second === description, 'Description should be same than given description');
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/payment');
        });
    });
    it('Test optional payment parameters', () => {
        const skipFormNotifications = true;
        const exitIframeOnResult = true;
        const exitIframeOn3ds = true;
        const use3ds = true;
        const showPaymentMethodSelector = true;
        const formContainer = formBuilder.generatePaymentParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, skipFormNotifications, exitIframeOnResult, exitIframeOn3ds, use3ds, undefined, undefined, undefined, undefined, showPaymentMethodSelector);
        testNameValuePairs(formContainer.nameValuePairs, 19);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/select_payment_method');
        });
    });
    it('Test mandatory PayWithTokenAndCvc parameters', () => {
        chai_1.assert(cardToken !== undefined, 'Token isn\'t resolved yet');
        const formContainer = formBuilder.generatePayWithTokenAndCvcParameters(cardToken, successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description);
        testNameValuePairs(formContainer.nameValuePairs, 15);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/payment_with_token_and_cvc');
        });
    });
    it('Test optional PayWithTokenAndCvc parameters', () => {
        chai_1.assert(cardToken !== undefined, 'Token isn\'t resolved yet');
        const skipFormNotifications = true;
        const exitIframeOnResult = true;
        const exitIframeOn3ds = true;
        const use3ds = true;
        const formContainer = formBuilder.generatePayWithTokenAndCvcParameters(cardToken, successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, skipFormNotifications, exitIframeOnResult, exitIframeOn3ds, use3ds);
        testNameValuePairs(formContainer.nameValuePairs, 19);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/payment_with_token_and_cvc');
        });
    });
    it('Test add card and payment parameters with mandatory parameters', () => {
        const formContainer = formBuilder.generateAddCardAndPaymentParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description);
        testNameValuePairs(formContainer.nameValuePairs, 14);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/payment');
        });
    });
    it('Test add card and payment parameters with optional parameters', () => {
        const skipFormNotifications = true;
        const exitIframeOnResult = true;
        const exitIframeOn3ds = true;
        const use3ds = true;
        const formContainer = formBuilder.generateAddCardAndPaymentParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, skipFormNotifications, exitIframeOnResult, exitIframeOn3ds, use3ds);
        testNameValuePairs(formContainer.nameValuePairs, 18);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/payment');
        });
    });
    it('Test mobilepay form with mandatory parameters', () => {
        const formContainer = formBuilder.generatePayWithMobilePayParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description);
        testNameValuePairs(formContainer.nameValuePairs, 14);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 200, 'Response status code should be 200, got ' + response.statusCode);
        });
    });
    it('Test mobilepay form with optional parameters', () => {
        const formContainer = formBuilder.generatePayWithMobilePayParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, true, 'https://foo.bar', '+35844123465', 'Jaskan kello', '12345678', 'submerchantName');
        testNameValuePairs(formContainer.nameValuePairs, 20);
        return FormConnection_1.FormConnection.postForm(formContainer).then((response) => {
            chai_1.assert(response.statusCode === 200, 'Response status code should be 200, got ' + response.statusCode);
        });
    });
    it('Test 3ds PayWithTokenAndCvc parameters', () => {
        chai_1.assert(cardToken !== undefined, 'Token isn\'t resolved yet');
        const skipFormNotifications = false;
        const exitIframeOnResult = undefined;
        const exitIframeOn3ds = false;
        const use3ds = true;
        const formContainer = formBuilder.generatePayWithTokenAndCvcParameters(cardToken, successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, skipFormNotifications, exitIframeOnResult, exitIframeOn3ds, use3ds);
        testNameValuePairs(formContainer.nameValuePairs, 18);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            testRedirectResponse(response, '/payment_with_token_and_cvc');
        });
    });
    it('Test token debit', () => {
        chai_1.assert(cardToken !== undefined, 'Token isn\'t resolved yet');
        const paymentAPI = new __2.PaymentAPI(baseUrl, signatureKeyId, signatureSecret, sphAccount, sphMerchant);
        let initResponse;
        const testCardToken = new __5.Token(cardToken);
        return paymentAPI.initTransaction().then((response) => {
            initResponse = response;
            const transactionRequest = new __4.TransactionRequest(testCardToken, 9999, 'USD', orderId);
            return paymentAPI.debitTransaction(initResponse.id, transactionRequest);
        }).then((debitResponse) => {
            chai_1.assert(debitResponse.result.code === 100, 'Request should succeed with code 100, complete response was: ' + JSON.stringify(debitResponse));
            chai_1.assert(debitResponse.result.message === 'OK', 'Request should succeed with message "OK", complete response was: ' + JSON.stringify(debitResponse));
        });
    });
    it('Test masterpass form with mandatory parameters', () => {
        const formContainer = formBuilder.generateMasterPassParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description);
        testNameValuePairs(formContainer.nameValuePairs, 14);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
            chai_1.assert.match(response.headers.location, /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/masterpass/, 'redirect location doesn\'t match ' + response.header);
        });
    });
    it('Test masterpass form with optional parameters', () => {
        const formContainer = formBuilder.generateMasterPassParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
        testNameValuePairs(formContainer.nameValuePairs, 16);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
            chai_1.assert.match(response.headers.location, /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/masterpass/, 'redirect location doesn\'t match ' + response.header);
        });
    });
    it('Test siirto form with mandatory parameters', () => {
        const referenceNumber = '1313';
        const formContainer = formBuilder.generateSiirtoParameters(successUrl, failureUrl, cancelUrl, language, amount, orderId, description, referenceNumber);
        testNameValuePairs(formContainer.nameValuePairs, 15);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
            chai_1.assert.match(response.headers.location, /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/siirto/, 'redirect location doesn\'t match ' + response.header);
        });
    });
    it('Test siirto form with optional parameters', () => {
        const phoneNumber = '+358441234567';
        const referenceNumber = '1313';
        const formContainer = formBuilder.generateSiirtoParameters(successUrl, failureUrl, cancelUrl, language, amount, orderId, description, referenceNumber, phoneNumber);
        testNameValuePairs(formContainer.nameValuePairs, 16);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
            chai_1.assert.match(response.headers.location, /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/siirto/, 'redirect location doesn\'t match ' + response.header);
        });
    });
    it('Test add card webhook parameters', () => {
        const formContainer = formBuilder.generateAddCardParameters(successUrl, failureUrl, cancelUrl, language, undefined, undefined, undefined, undefined, undefined, webhookSuccessUrl, webhookFailureUrl, webhookCancelUrl, webhookDelay);
        testNameValuePairs(formContainer.nameValuePairs, 14);
        testWebhookNameValuePairs(formContainer.nameValuePairs);
    });
    it('Test payment webhook parameters', () => {
        const formContainer = formBuilder.generatePaymentParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, undefined, undefined, undefined, undefined, webhookSuccessUrl, webhookFailureUrl, webhookCancelUrl, webhookDelay);
        testNameValuePairs(formContainer.nameValuePairs, 18);
        testWebhookNameValuePairs(formContainer.nameValuePairs);
    });
    it('Test add card and payment webhook parameters', () => {
        const formContainer = formBuilder.generateAddCardAndPaymentParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, undefined, undefined, undefined, undefined, webhookSuccessUrl, webhookFailureUrl, webhookCancelUrl, webhookDelay);
        testNameValuePairs(formContainer.nameValuePairs, 18);
        testWebhookNameValuePairs(formContainer.nameValuePairs);
    });
    it('Test pay with token and cvc webhook parameters', () => {
        const token = '123';
        const formContainer = formBuilder.generatePayWithTokenAndCvcParameters(token, successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, undefined, undefined, undefined, undefined, webhookSuccessUrl, webhookFailureUrl, webhookCancelUrl, webhookDelay);
        testNameValuePairs(formContainer.nameValuePairs, 19);
        testWebhookNameValuePairs(formContainer.nameValuePairs);
    });
    it('Test mobilepay webhook parameters', () => {
        const formContainer = formBuilder.generatePayWithMobilePayParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, undefined, undefined, undefined, undefined, undefined, undefined, webhookSuccessUrl, webhookFailureUrl, webhookCancelUrl, webhookDelay);
        testNameValuePairs(formContainer.nameValuePairs, 18);
        testWebhookNameValuePairs(formContainer.nameValuePairs);
    });
    it('Test masterpass webhook parameters', () => {
        const formContainer = formBuilder.generateMasterPassParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, undefined, undefined, undefined, undefined, webhookSuccessUrl, webhookFailureUrl, webhookCancelUrl, webhookDelay);
        testNameValuePairs(formContainer.nameValuePairs, 18);
        testWebhookNameValuePairs(formContainer.nameValuePairs);
    });
    it('Test webhook parameters without delay', () => {
        const formContainer = formBuilder.generatePaymentParameters(successUrl, failureUrl, cancelUrl, language, amount, currency, orderId, description, undefined, undefined, undefined, undefined, webhookSuccessUrl, webhookFailureUrl, webhookCancelUrl);
        testNameValuePairs(formContainer.nameValuePairs, 17);
        testWebhookNameValuePairs(formContainer.nameValuePairs, true);
    });
    it('Test pivo mandatory parameters', () => {
        const formContainer = formBuilder.generatePivoParameters(successUrl, failureUrl, cancelUrl, language, amount, orderId, description);
        testNameValuePairs(formContainer.nameValuePairs, 14);
        const actionUrl = '/form/view/pivo';
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
            chai_1.assert.match(response.headers.location, /https:\/\/qa-maksu.pivo.fi\/api\/payments\//, 'redirect location doesn\'t match ' + response.header);
        });
    });
    it('Test pivo optional parameters', () => {
        const phoneNumber = '+358444160589';
        const referenceNumber = '1313';
        const appUrl = 'myapp://url';
        const formContainer = formBuilder.generatePivoParameters(successUrl, failureUrl, cancelUrl, language, amount, orderId, description, referenceNumber, phoneNumber, appUrl);
        testNameValuePairs(formContainer.nameValuePairs, 17);
        assertNameValuePair(formContainer.nameValuePairs, 'sph-phone-number', phoneNumber);
        assertNameValuePair(formContainer.nameValuePairs, 'sph-reference-number', referenceNumber);
        assertNameValuePair(formContainer.nameValuePairs, 'sph-app-url', appUrl);
        return FormConnection_1.FormConnection.postForm(formContainer)
            .then((response) => {
            chai_1.assert(response.statusCode === 303, 'Response status code should be 303, got ' + response.statusCode);
            chai_1.assert.match(response.headers.location, /https:\/\/qa-maksu.pivo.fi\/api\/payments\//, 'redirect location doesn\'t match ' + response.header);
        });
    });
    it('Test pivo app url', () => {
        const formContainer = formBuilder.generatePivoParameters(successUrl, failureUrl, cancelUrl, language, amount, orderId, description, '+358444160589', undefined, 'myapp://url');
        testNameValuePairs(formContainer.nameValuePairs, 16);
        const actionUrl = '/form/view/pivo';
        chai_1.assert(formContainer.actionUrl === actionUrl, 'action url should be ' + actionUrl + 'got ' + formContainer.actionUrl);
    });
});
//# sourceMappingURL=FormBuilderTest.js.map