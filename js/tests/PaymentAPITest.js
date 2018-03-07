"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const moment = require("moment");
const PaymentAPI_1 = require("../src/PaymentAPI");
const PaymentHighwayUtility_1 = require("../src/PaymentHighwayUtility");
const Card_1 = require("../src/model/request/Card");
const TransactionRequest_1 = require("../src/model/request/TransactionRequest");
const CommitTransactionRequest_1 = require("../src/model/request/CommitTransactionRequest");
const RevertTransactionRequest_1 = require("../src/model/request/RevertTransactionRequest");
const MasterpassTransactionRequest_1 = require("../src/model/request/MasterpassTransactionRequest");
const ApplePayTransactionRequest_1 = require("../src/model/request/ApplePayTransactionRequest");
let api;
let validCard;
let testCard;
beforeEach(() => {
    api = new PaymentAPI_1.PaymentAPI('https://v1-hub-staging.sph-test-solinor.com/', 'testKey', 'testSecret', 'test', 'test_merchantId');
    testCard = new Card_1.Card('4153013999700024', '2023', '11', '024');
    validCard = {
        card: testCard,
        amount: 99,
        currency: 'EUR',
        blocking: true,
        orderId: PaymentHighwayUtility_1.PaymentHighwayUtility.createRequestId()
    };
});
function createDebitTransaction(orderId, commit) {
    let initResponse;
    return api.initTransaction().then((response) => {
        initResponse = response;
        let transactionRequest = new TransactionRequest_1.TransactionRequest(testCard, 9999, 'EUR', orderId);
        if (typeof commit !== 'undefined') {
            transactionRequest.commit = commit;
        }
        return api.debitTransaction(initResponse.id, transactionRequest);
    }).then((debitResponse) => {
        checkResult(debitResponse);
        return initResponse;
    });
}
function checkResult(response) {
    chai_1.assert(response.result.code === 100, 'Request should succeed with code 100, complete response was: ' + JSON.stringify(response));
    chai_1.assert(response.result.message === 'OK', 'Request should succeed with message "OK", complete response was: ' + JSON.stringify(response));
}
function printResult(response) {
    return ', complete result was: \n' + JSON.stringify(response);
}
describe('PaymentAPI', () => {
    it('Should have instance of PaymentHighwayAPI', () => {
        chai_1.assert.instanceOf(api, PaymentAPI_1.PaymentAPI, 'Was not instance of PaymentAPI');
    });
    it('Test init transaction', (done) => {
        api.initTransaction().then((body) => {
            checkResult(body);
            chai_1.assert.isNotNull(body.id, 'Transaction init should return id');
            done();
        });
    });
    it('Test debit transaction', (done) => {
        createDebitTransaction().then((body) => {
            chai_1.assert.isNotNull(body.id, 'Transaction id not received');
            done();
        });
    });
    it('Test commit transaction', (done) => {
        const commitRequest = new CommitTransactionRequest_1.CommitTransactionRequest(9999, 'EUR');
        let transactionId;
        createDebitTransaction('12345ABC', false)
            .then((initResponse) => {
            transactionId = initResponse.id;
            return api.commitTransaction(transactionId, commitRequest);
        })
            .then((commitResponse) => {
            checkResult(commitResponse);
            chai_1.assert(commitResponse.card.type === 'Visa', 'Card type should be "Visa"' + printResult(commitResponse));
            chai_1.assert(commitResponse.card.cvc_required === 'not_tested', 'Test card should return cvc_required = not_tested' + printResult(commitResponse));
            chai_1.assert(commitResponse.recurring === false, 'Transaction should have recurring as false.' + printResult(commitResponse));
            return api.transactionResult(transactionId);
        })
            .then((resultResponse) => {
            chai_1.assert(resultResponse.recurring === false, 'Transaction result should have recurring false.' + printResult(resultResponse));
            checkResult(resultResponse);
            done();
        });
    });
    it('Test uncommitted transaction', (done) => {
        let transactionId;
        createDebitTransaction('12345DEF', false)
            .then((initResponse) => {
            transactionId = initResponse.id;
            done();
        });
    });
    it('Test revert transaction', (done) => {
        createDebitTransaction()
            .then((initResponse) => {
            return api.revertTransaction(initResponse.id, new RevertTransactionRequest_1.RevertTransactionRequest(9999));
        })
            .then((revertResponse) => {
            checkResult(revertResponse);
            done();
        });
    });
    it('Test revert whole transaction', (done) => {
        let transactionId;
        createDebitTransaction()
            .then((initResponse) => {
            transactionId = initResponse.id;
            return api.revertTransaction(transactionId, new RevertTransactionRequest_1.RevertTransactionRequest());
        })
            .then((revertResponse) => {
            checkResult(revertResponse);
            return api.transactionStatus(transactionId);
        })
            .then((statusResponse) => {
            checkResult(statusResponse);
            chai_1.assert(statusResponse.transaction.current_amount === 0, 'Transaction current amount should be 0' + printResult(statusResponse));
            chai_1.assert(statusResponse.transaction.id === transactionId, 'Transaction id should be same with init response and revert response' + printResult(statusResponse));
            done();
        });
    });
    it('Test transaction status', (done) => {
        let transactionId;
        createDebitTransaction()
            .then((initResponse) => {
            transactionId = initResponse.id;
            return api.revertTransaction(transactionId, new RevertTransactionRequest_1.RevertTransactionRequest(9950));
        })
            .then(() => {
            return api.transactionStatus(transactionId);
        })
            .then((statusResponse) => {
            checkResult(statusResponse);
            chai_1.assert(statusResponse.transaction.current_amount === 49, 'Current amount should be 49, it was ' + statusResponse.transaction.current_amount + printResult(statusResponse));
            chai_1.assert(statusResponse.transaction.id === transactionId, 'Transaction id should be same with init response and revert response' + printResult(statusResponse));
            chai_1.assert(statusResponse.transaction.card.cvc_required === 'not_tested', 'Test card should return cvc_required = not_tested' + printResult(statusResponse));
            done();
        });
    });
    it('Test order search', (done) => {
        let transactionId;
        const orderId = PaymentHighwayUtility_1.PaymentHighwayUtility.createRequestId();
        createDebitTransaction(orderId)
            .then((initResponse) => {
            transactionId = initResponse.id;
            return api.searchOrders(orderId);
        })
            .then((searchResponse) => {
            checkResult(searchResponse);
            chai_1.assert(searchResponse.transactions[0].current_amount === 9999, 'Current amount for tested order should be 9999, it was: ' + searchResponse.transactions[0].current_amount + printResult(searchResponse));
            chai_1.assert(searchResponse.transactions[0].id === transactionId, 'Transaction id should be same with init response and search response' + printResult(searchResponse));
            chai_1.assert(searchResponse.transactions[0].recurring === false, 'Transaction should have recurring false' + printResult(searchResponse));
            done();
        });
    });
    it('Test daily batch report', (done) => {
        const date = moment().add(1, 'days').format('YYYYMMDD');
        api.fetchDailyReport(date)
            .then((reportResponse) => {
            checkResult(reportResponse);
            done();
        });
    });
    it('Test rejected debit response', (done) => {
        const testCardTokenizeOkPaymentFails = new Card_1.Card('4153013999700156', '2023', '11', '156');
        const orderId = PaymentHighwayUtility_1.PaymentHighwayUtility.createRequestId();
        let transactionResponse;
        api.initTransaction()
            .then((response) => {
            transactionResponse = response;
            const transactionRequest = new TransactionRequest_1.TransactionRequest(testCardTokenizeOkPaymentFails, 9999, 'EUR', orderId);
            return api.debitTransaction(transactionResponse.id, transactionRequest);
        })
            .then((debitResponse) => {
            chai_1.assert(debitResponse.result.code === 200, 'Authorization should fail (code 200), got ' + debitResponse.result.code);
            chai_1.assert(debitResponse.result.message === 'Authorization failed', 'Authorization should fail');
            return api.transactionResult(transactionResponse.id);
        })
            .then((resultResponse) => {
            chai_1.assert(resultResponse.result.code === 200, 'Authorization should fail (code 200), got ' + resultResponse.result.code);
            return api.transactionStatus(transactionResponse.id);
        })
            .then((statusResponse) => {
            chai_1.assert(statusResponse.transaction.committed === false, 'Committed should be false, got' + statusResponse.transaction.committed);
            done();
        });
    });
    it('Test Masterpass transaction', (done) => {
        const preGeneratedMasterpassTransaction = '327c6f29-9b46-40b9-b85b-85e908015d92';
        api.userProfile(preGeneratedMasterpassTransaction)
            .then((userProfileResponse) => {
            checkResult(userProfileResponse);
            const masterpass = userProfileResponse.masterpass;
            chai_1.assert(masterpass.amount === 100);
            chai_1.assert(masterpass.currency === 'EUR');
            chai_1.assert(masterpass.masterpass_wallet_id === '101');
            const profile = userProfileResponse.profile;
            chai_1.assert(profile.email_address === 'matti.meikalainen@gmail.com');
            chai_1.assert.isNotNull(profile.billing_address);
            chai_1.assert(profile.billing_address.country === 'FI');
            chai_1.assert.isNotNull(profile.shipping_address);
            chai_1.assert(profile.shipping_address.country === 'FI');
            const request = new MasterpassTransactionRequest_1.MasterpassTransactionRequest(50, 'EUR');
            return api.debitMasterpassTransaction(preGeneratedMasterpassTransaction, request);
        })
            .then((debitResponse) => {
            checkResult(debitResponse);
            done();
        });
    });
    it('Test Apple Pay request builders', () => {
        let amount = 100;
        let currency = 'EUR';
        let paymentToken = JSON.parse('{ "data": "ABCD", "header": { "ephemeralPublicKey": "XYZ", "publicKeyHash": "13579", "transactionId": "24680" }, "signature": "ABCDXYZ0000", "version": "EC_v1" }');
        chai_1.assert.strictEqual(paymentToken.data, 'ABCD', 'Data was not equal to ABCD');
        let withStaticBuilder = ApplePayTransactionRequest_1.ApplePayTransactionRequest.Builder(paymentToken, amount, currency).build();
        let withRequestBuilder = new ApplePayTransactionRequest_1.ApplePayTransaction.RequestBuilder(paymentToken, amount, currency).build();
        chai_1.assert.deepEqual(withStaticBuilder, withRequestBuilder, 'results differ from builder');
        let requestWithCommit = ApplePayTransactionRequest_1.ApplePayTransactionRequest.Builder(paymentToken, amount, currency).setCommit(true).build();
        chai_1.assert.notDeepEqual(withStaticBuilder, requestWithCommit, 'requests should differ if commit is added');
        chai_1.assert(withStaticBuilder.amount === 100);
    });
    it('Test Apple Pay validators', () => {
        let amount = 100;
        let currency = 'EUR';
        // Syntax is valid, but content will fail
        let paymentToken = JSON.parse('{ "data": "ABCD", "header": { "ephemeralPublicKey": "XYZ=", "publicKeyHash": "13579ABC", "transactionId": "0002040608" }, "signature": "ABCD13579ABC", "version": "EC_v1" }');
        return api.initTransaction()
            .then((response) => {
            const request = ApplePayTransactionRequest_1.ApplePayTransactionRequest.Builder(paymentToken, amount, currency).build();
            return api.debitApplePayTransaction(response.id, request);
        })
            .then((debitResponse) => {
            chai_1.assert(debitResponse.result.code === 900, 'Authorization should fail (code 900), got ' + debitResponse.result.code);
            chai_1.assert.equal(debitResponse.result.message, 'ERROR', 'Authorization should fail with ERROR, validation should succeed');
        });
    });
});
//# sourceMappingURL=PaymentAPITest.js.map