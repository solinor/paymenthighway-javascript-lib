import { Customer } from './Customer';
import { PaymentData } from './applepay/PaymentData';
import { Request } from './PhRequest';
import { Splitting } from '../Splitting';
export declare class ApplePayTransactionRequest extends Request {
    payment_data: PaymentData;
    amount: number;
    currency: string;
    commit?: boolean;
    order?: string;
    customer?: Customer;
    reference_number?: string;
    splitting?: Splitting;
    constructor(payment_data: PaymentData, amount: number, currency: string, commit?: boolean, order?: string, customer?: Customer, reference_number?: string, splitting?: Splitting);
    static Builder(payment_data: PaymentData, amount: number, currency: string): ApplePayTransaction.RequestBuilder;
}
export declare namespace ApplePayTransaction {
    class RequestBuilder {
        private payment_data;
        private amount;
        private currency;
        private commit?;
        private order?;
        private customer?;
        private reference_number?;
        private splitting?;
        constructor(payment_data: PaymentData, amount: number, currency: string);
        setCommit(commit: boolean): RequestBuilder;
        setOrder(order: string): RequestBuilder;
        setCustomer(customer: Customer): RequestBuilder;
        setSplitting(splitting: Splitting): this;
        /**
         * Reference number used when settling the transaction to the merchant account.
         * Only used if one-by-ony transaction settling is configured.
         * @param referenceNumber In RF or Finnish reference number format.
         */
        setReferenceNumber(referenceNumber: string): this;
        build(): ApplePayTransactionRequest;
    }
}
