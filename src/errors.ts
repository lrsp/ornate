import * as httpStatus from "http-status-codes";

export class AppError<T> extends Error {

    private _code: number;
    private _data: T;

    constructor(name: string, code: number, message: string, data?: T) {
        super(message);
        this.name = name;
        this._code = code;
        this._data = data;
    }

    public get code(): number {
        return this._code;
    }

    public get data(): T {
        return this._data;
    }

}

export class AuthenticationError extends AppError<any> {
    constructor(message: string, data?: any) {
        super("AuthenticationError", httpStatus.UNAUTHORIZED, message, data);
    }
}

export class AuthorizationError extends AppError<any> {
    constructor(message: string, data?: any) {
        super("AuthorizationError", httpStatus.FORBIDDEN, message, data);
    }
}

export class InternalServerError extends AppError<any> {
    constructor(message: string) {
        super("InternalServerError", httpStatus.INTERNAL_SERVER_ERROR, message);
    }
}

export class ResourceError extends AppError<any> {

    constructor(message: string, data?: any) {
        super("ResourceError", httpStatus.CONFLICT, message, data);
    }
}

export class ParameterError extends AppError<string> {
    constructor(message: string, parameter?: string) {
        super("ParameterError", httpStatus.BAD_REQUEST, message, parameter);
    }
}
