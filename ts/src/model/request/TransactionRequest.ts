import {Card} from './Card';
import {Token} from '../Token';

export class TransactionRequest {
    public card: Card;
    public amount: number;
    public currency: string;
    public token: Token;
    public order: string;
    public customer: string;
    public commit: boolean;

    constructor(cardOrToken: Card|Token, amount: number, currency: string, order?: string, customer?: string, commit?: boolean) {
        if (cardOrToken instanceof Card) {
            this.card = cardOrToken;
        } else {
            this.token = cardOrToken;
        }
        this.amount = amount;
        this.currency = currency;
        this.order = order;
        this.customer = customer;
        this.commit = commit;
    }
}
