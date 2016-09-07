import * as Crypto from 'crypto';
import {Pair} from "../util/Pair";

/**
 * Creates a signature for PaymentHighway messages
 */
export class SecureSigner {

    private signatureScheme: string = 'SPH1';
    private algorithm: string = 'HmacSHA256';

    constructor(private secretKeyId: string, private secretKey: string) {
    }

    /**
     * Create signature
     *
     * @param method
     * @param uri
     * @param keyValues
     * @param body
     * @return String eg:
     * "SPH1 testKey 51dcbaf5a9323daed24c0cdc5bb5d344f321aa84435b64e5da3d8f6c49370532"
     */
    public createSignature(method: string, uri: string, keyValues: Pair<string, string>[], body: string): string {
        return this.signatureScheme + ' ' + this.secretKeyId + ' ' + this.sign(method, uri, keyValues, body);
    }

    /**
     * Create signature String from the actual parameters
     *
     * @param method
     * @param uri
     * @param keyValues
     * @param body
     * @return String signature
     */
    private sign(method: string, uri: string, keyValues: Pair<string, string>[], body: string): string {
        const stringToSign: string = method + '\n' + uri + '\n' + this.createKeyValString(keyValues) + '\n' + body.trim();
        const hmac = Crypto.createHmac(this.algorithm, this.secretKey).update(stringToSign).digest('hex');
        return hmac.toLowerCase();
    }

    /**
     * Signature is formed from parameters that start with "sph-" Therefore we
     * remove other parameters from the signature param set.
     *
     * @param keyValues
     * @returns string
     */
    private createKeyValString(keyValues: Pair<string, string>[]): string {
        return keyValues.filter((x) => {
            return x.first.toLowerCase().startsWith('sph-');
        }).sort((k1, k2) => {
            if (k1.first > k2.first) {
                return 1;
            }
            if (k1.first < k2.first) {
                return -1;
            }
            return 0;
        }).map((x: Pair<string, string>) => {
            return x.first.toLowerCase() + ':' + x.second;
        }).join('\n');
    }

    /**
     * Validates the response by checking the provided signature against the calculated one.
     *
     * @param method HTTP METHOD e.g. POST or GET
     * @param uri The request URI
     * @param keyValues The key value pairs of headers or request parameters
     * @param content The body content
     * @return boolean true if signature is found and matches the calculated one
     */
    public validateSignature(method: string, uri: string, keyValues: Pair<string, string>[], content: string): boolean {

        const receivedSignature = keyValues.find((x) => {
            return x.first.toLowerCase() === 'signature';
        }).second;

        if (typeof receivedSignature === 'undefined') {
            return false;
        }

        const createdSignature = this.createSignature(method, uri, keyValues, content);
        return receivedSignature === createdSignature;
    }

    /**
     * Validates the response redirection by checking the provided signature against the calculated one.
     * @param keyValues The request parameters from the redirection
     * @return boolean
     */
    public validateFormRedirect(keyValues: Pair<string, string>[]): boolean {
        return this.validateSignature('GET', '', keyValues, '');
    }

}
