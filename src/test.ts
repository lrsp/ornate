
import { AddressInfo } from "net";
import * as http from "http";
import * as util from "util";
import * as fetch from "node-fetch";
import * as httpStatus from "http-status-codes";

const HEADER_CONTENT_LENGTH  = "content-length";
const HEADER_CONTENT_TYPE = "content-type";

const CONTENT_TYPE_TEXT_PLAIN = "text/plain";
const CONTENT_TYPE_TEXT_HTML = "text/html";
const CONTENT_TYPE_TEXT_XML = "application/xml";
const CONTENT_TYPE_JSON = "application/json";

export interface IHttpHeaders {
    [key: string]: string;
}

export interface IApiResponse<T> {
    headers: IHttpHeaders;
    body: T;
}

export class TestError extends Error {

    private _route: string;
    private _status: number;
    private _statusText: string;

    constructor(route: string, status: number, statusText: string, message: string) {
        super(message);

        this._route = route;
        this._status = status;
        this._statusText = statusText;
    }

    public get route(): string {
        return this._route;
    }

    public get status(): number {
        return this._status;
    }

    public get statusText(): string {
        return this._statusText;
    }
}

export interface ITestRequestOptions {
    body?: fetch.BodyInit;
    headers?: fetch.HeaderInit;
}

export class Test {

    private _server: http.Server;
    private _host: string;

    private _method: string;
    private _url: string;
    private _options: ITestRequestOptions;

    constructor(server: http.Server, method: string, url: string, options: ITestRequestOptions) {
        this._server = server.listen(0);

        const info = this._server.address() as AddressInfo;
        this._host = util.format("http://127.0.0.1:%s", info.port);
        this._method = method;
        this._url = url;
        this._options = options;
    }

    public async run<T>(): Promise<IApiResponse<T>> {
        try {
            const options = {
                method: this._method,
                ...this._options
            };

            const response = await fetch.default(this._host + this._url, options);

            if (response.status !== httpStatus.OK) {
                const url = `${this._method} ${this._host}${this._url}`;
                const message = await response.text();

                throw new TestError(url, response.status, response.statusText, message);
            }

            const headers = this._getHeaders(response);
            const body = await this._getBody<T>(response);

            this.end();

            return {
                headers,
                body: body as T
            };

        } catch (err) {
            this.end();
            throw err;
        }
    }

    public end(): void {
        this._server.close();
    }

    private _getHeaders(response: fetch.Response): IHttpHeaders {
        const entries = response.headers.entries();

        const headers: IHttpHeaders = {};
        let result = entries.next();
        while (!result.done) {
            const key = result.value[0];
            const value = result.value[1];
            headers[key] = value;
            result = entries.next();
        }

        return headers;
    }

    private async _getBody<T>(response: fetch.Response): Promise<T | string> {
        const contentLength = parseInt(response.headers.get(HEADER_CONTENT_LENGTH), 10);
        if (contentLength === 0) {
            return undefined;
        }

        const [contentType] = response.headers.get(HEADER_CONTENT_TYPE).split(";");

        switch (contentType) {
            case CONTENT_TYPE_JSON:
                return response.json();

            case CONTENT_TYPE_TEXT_PLAIN:
            case CONTENT_TYPE_TEXT_HTML:
            case CONTENT_TYPE_TEXT_XML:
            default:
                return response.text();
        }
    }

}
