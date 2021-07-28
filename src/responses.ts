import * as httpStatus from "http-status-codes";

export const enum EResponseType {
    NULL = 0,
    RAW = 1,
    TEXT = 2,
    JSON = 3
}

export interface IResponseHeaders {
    [key: string]: string;
}

export class ActionResponse<T> {

    private _status: number;
    private _type: EResponseType;
    private _data: T;
    private _headers: IResponseHeaders;
    private _next: boolean;

    constructor(status: number, type: EResponseType, data: T, headers: IResponseHeaders, next = true) {
        this._status = status;
        this._type = type;
        this._data = data;
        this._headers = headers;
        this._next = next;
    }

    public get status(): number {
        return this._status;
    }

    public get type(): EResponseType {
        return this._type;
    }

    public get data(): T {
        return this._data;
    }

    public get headers(): IResponseHeaders {
        return this._headers;
    }

    public get next(): boolean {
        return this._next;
    }

}

export class NullResponse extends ActionResponse<void> {
    constructor(headers?: IResponseHeaders, next = true) {
        super(httpStatus.OK, EResponseType.RAW, undefined, headers, next);
    }
}

export class RawResponse extends ActionResponse<Buffer> {
    constructor(data: Buffer, headers?: IResponseHeaders, next = false) {
        super(httpStatus.OK, EResponseType.RAW, data, headers, next);
    }
}

export class TextResponse extends ActionResponse<string> {
    constructor(data: string, headers?: IResponseHeaders, next = false) {
        super(httpStatus.OK, EResponseType.TEXT, data, headers, next);
    }
}

export class JsonResponse<T> extends ActionResponse<T> {
    constructor(data?: T, headers?: IResponseHeaders, next = false) {
        super(httpStatus.OK, EResponseType.JSON, data, headers, next);
    }
}

export class RedirectResponse extends ActionResponse<string> {
    constructor(url: string, headers?: IResponseHeaders, next = false) {
        super(httpStatus.MOVED_TEMPORARILY, EResponseType.JSON, url, headers, next);
    }
}
