/// <reference types="node" />

import * as http from "http";
import * as fetch from "node-fetch";
import * as bodyParser from "body-parser";
import express from "express";
import "reflect-metadata";

export class AppError<T> extends Error {
    constructor(name: string, code: number, message: string, data?: T);
    readonly code: number;
    readonly data: T;
}
export class AuthenticationError extends AppError<any> {
    constructor(message: string, data?: any);
}
export class AuthorizationError extends AppError<any> {
    constructor(message: string, data?: any);
}
export class InternalServerError extends AppError<any> {
    constructor(message: string);
}
export class ResourceError extends AppError<any> {
    constructor(message: string, data?: any);
}
export class ParameterError extends AppError<string> {
    constructor(message: string, parameter?: string);
}
export const enum ResponseType {
    NULL = 0,
    RAW = 1,
    TEXT = 2,
    JSON = 3
}
export interface IResponseHeaders {
    [key: string]: string;
}
export class ActionResponse<T> {
    constructor(status: number, type: ResponseType, data: T, headers: IResponseHeaders, next?: boolean);
    readonly status: number;
    readonly type: ResponseType;
    readonly data: T;
    readonly headers: IResponseHeaders;
    readonly next: boolean;
}
export class NullResponse extends ActionResponse<void> {
    constructor(headers?: IResponseHeaders, next?: boolean);
}
export class RawResponse extends ActionResponse<Buffer> {
    constructor(data: Buffer, headers?: IResponseHeaders, next?: boolean);
}
export class TextResponse extends ActionResponse<string> {
    constructor(data: string, headers?: IResponseHeaders, next?: boolean);
}
export class JsonResponse<T> extends ActionResponse<T> {
    constructor(data?: T, headers?: IResponseHeaders, next?: boolean);
}
export class RedirectResponse extends ActionResponse<string> {
    constructor(url: string, headers?: IResponseHeaders, next?: boolean);
}
export const enum EMiddlewareOrder {
    BEFORE = "before",
    AFTER = "after"
}
export const enum EArgType {
    REQUEST = "request",
    RESPONSE = "response",
    HOST = "host",
    HOSTNAME = "hostname",
    HEADER = "header",
    BODY = "body",
    PARAM = "param",
    QUERY = "query",
    METHOD = "method",
    ROUTE = "route"
}
export const enum ERequestMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    OPTIONS = "OPTIONS",
    HEAD = "HEAD",
    PATCH = "PATCH"
}
export const enum EPropertyType {
    HTTP_SERVER = 0
}
export const enum EInjectableType {
    HTTP_SERVER = 0
}
export type ActionHandler<T> = (...args: any[]) => Promise<ActionResponse<T>>;
export type MiddlewareHandler<T> = (...args: any[]) => Promise<T>;
export type IType<T> = new (...args: any[]) => T;
export type AnyType = IType<any>;
export interface IRoute {
    readonly method: ERequestMethod;
    readonly path: string;
}
export interface IPermission {
    readonly name: string;
    readonly routes: IRoute[];
}
export interface IRole {
    readonly name: string;
    readonly permissions: IPermission[];
}
export interface IAuthentication {
    readonly user: {
        readonly id?: any;
        readonly name: string;
    };
    readonly roles: IRole[];
}
export interface IAuthProvider {
    checkRoutePermissions(auth: IAuthentication[], method: ERequestMethod, path: string): boolean;
}
export interface IProviderParameters {
    readonly provides: any;
    readonly service: IType<any>;
}
export interface IModuleParameters {
    readonly route?: string;
    readonly modules?: AnyType[];
    readonly services?: AnyType[];
    readonly initialize?: AnyType[];
    readonly migrations?: AnyType[];
    readonly providers?: IProviderParameters[];
    readonly controllers?: AnyType[];
    readonly auth?: Array<IType<IAuthProvider>>;
}
export interface IModuleMetadata {
    readonly name: string;
    readonly params: IModuleParameters;
}
export interface IServiceMetadata {
    readonly name: string;
    readonly properties: IPropertyMetadata[];
    readonly middlewares: IMiddlewareMetadata[];
}
export interface IMigrationMetadata {
    readonly name: string;
}
export interface IInjectableMetadata {
    readonly type: EInjectableType;
    readonly index: number;
}
export interface IProviderMetadata {
    readonly name: string;
    readonly index: number;
}
export interface IPropertyMetadata {
    type: EPropertyType;
    name: string;
}
export interface IMiddlewareMetadata {
    readonly service: string;
    readonly name: string;
    readonly handler: MiddlewareHandler<any>;
    readonly args: IActionArgsMetadata[];
    readonly session: ISessionResourceMetadata[];
}
export interface IControllerMetadata {
    readonly name: string;
    readonly route: string;
    readonly actions: IActionMetadata[];
}
export interface IActionMetadata {
    readonly target: IType<any>;
    readonly method: ERequestMethod;
    readonly route: string;
    readonly handler: ActionHandler<any>;
    readonly args: IActionArgsMetadata[];
    readonly resolve: IActionResolveMetadata[];
    readonly policies: IActionPolicyMetadata[];
}
export interface IActionMiddlewareMetadata {
    readonly service: IType<any>;
    readonly order: EMiddlewareOrder;
    readonly name: string;
    readonly params: any[];
}
export interface IActionArgsMetadata {
    readonly type: EArgType;
    readonly index: number;
    readonly name: string;
    readonly required: boolean;
}
export interface IActionResolveMetadata {
    readonly service: IType<any>;
    readonly index: number;
    readonly name: string;
    readonly auth: boolean;
    readonly optional: boolean;
}
export interface ISessionResourceMetadata {
    readonly index: number;
    readonly name: string;
    readonly required: boolean;
}
export interface IActionPolicyMetadata {
    readonly service: IType<any>;
    readonly index: number;
    readonly name: string;
}
export function Module(params?: IModuleParameters): (target: IType<any>) => void;
export function Service(): <T>(target: IType<T>) => void;
export function Migration(name: string): <T>(target: IType<T>) => void;
export function Controller(route: string): <T>(target: IType<T>) => void;
export function HttpServer(): (target: any, handler: string, index: number) => void;
export function Middleware(name: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Get(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Post(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Put(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Delete(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Before<T>(service: IType<T>, name: string, ...params: any[]): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function After<T>(service: IType<T>, name: string, ...params: any[]): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Auth<T>(service: IType<T>, name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Resolve<T>(service: IType<T>, name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Policy<T>(service: IType<T>, name: string): (target: any, handler: string, index: number) => void;
export function Session(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Req(): (target: any, handler: string, index: number) => void;
export function Res(): (target: any, handler: string, index: number) => void;
export function Host(): (target: any, handler: string, index: number) => void;
export function Hostname(): (target: any, handler: string, index: number) => void;
export function Header(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Authorization(type: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Body(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Param(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Query(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Method(): (target: any, handler: string, index: number) => void;
export function Route(): (target: any, handler: string, index: number) => void;
export class Registry {
    static defineProperty(target: any, name: string, type: EPropertyType): void;
    static defineModule<T>(targetModule: IType<T>, params: IModuleParameters): void;
    static defineService<T>(targetService: IType<T>): void;
    static defineMigration<T>(targetMigration: IType<T>, name: string): void;
    static defineController(targetController: IType<any>, route: string): void;
    static defineInjectable(target: IType<any>, type: EInjectableType, index: number): void;
    static defineMiddleware(targetService: IType<any>, name: string, handler: MiddlewareHandler<any>): void;
    static defineAction(targetController: IType<any>, method: ERequestMethod, route: string, handler: ActionHandler<any>): void;
    static defineActionMiddleware<T>(targetController: IType<any>, order: EMiddlewareOrder, service: IType<T>, name: string, params: any[], handler: ActionHandler<any>): void;
    static defineActionArg(target: IType<any>, type: EArgType, handler: string, index: number, name: string, required: boolean): void;
    static defineResolver<T>(target: IType<any>, handler: string, index: number, service: IType<T>, name: string, required: boolean): void;
    static definePolicy<T>(target: IType<any>, handler: string, index: number, service: IType<T>, name: string): void;
    static defineSessionResource(target: IType<any>, handler: string, index: number, name: string, required: boolean): void;
    static getModuleMetadata<T>(targetModule: IType<T>): IModuleMetadata;
    static getServiceMetadata<T>(targetService: IType<T>): IServiceMetadata;
    static getMigrationMetadata<T>(targetMigration: IType<T>): IMigrationMetadata;
    static getControllerMetadata<T>(injectedController: IType<T>): IControllerMetadata;
    static getMiddlewareMetadata<T>(targetService: IType<T>, name: string): IMiddlewareMetadata;
    static getActionMiddlewareMetadata<T>(targetController: IType<T>, handler: ActionHandler<any>): IActionMiddlewareMetadata[];
    static getInjectableMetadata<T>(targetService: IType<T>): IInjectableMetadata[];
}
interface IServiceInstance {
    onInit?(app?: App): Promise<void>;
    onDestroy?(): Promise<void>;
    [middleware: string]: any;
}
interface IMigrationInstance {
    up(): Promise<void>;
    down(): Promise<void>;
}
export interface IAuthorizationHeader {
    readonly type: string;
    readonly credentials: string;
}
export interface ILogger {
    trace(...args: any[]): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}
export interface IBodyParserParams {
    readonly raw?: bodyParser.Options;
    readonly text?: bodyParser.OptionsText;
    readonly json?: bodyParser.OptionsJson;
    readonly urlencoded?: bodyParser.OptionsUrlencoded;
}
export interface IAppParams {
    readonly logger?: ILogger;
    readonly modules: Array<IType<any>>;
    readonly parser?: IBodyParserParams;
}
export interface IAppRequest extends express.Request {
    args: any[];
    session: Map<string, any>;
}
export type AppResponse = express.Response;
export class App {
    constructor(params: IAppParams);
    getModule<T>(target: IType<T>): T;
    getService<T extends IServiceInstance>(target: IType<T>): T;
    getMigrations(): string[];
    getMigration<T extends IMigrationInstance>(name: string): T;
    getRouter(): {
        [type: string]: (url: string, options?: ITestRequestOptions) => Test;
    };
    run(): Promise<void>;
    stop(): Promise<void>;
    close(): Promise<void>;
    listen(host: string, port: number): Promise<void>;
}
export interface IHttpHeaders {
    [key: string]: string;
}
export interface IApiResponse<T> {
    headers: IHttpHeaders;
    body: T;
}
export class TestError extends Error {
    constructor(route: string, status: number, statusText: string, message: string);
    readonly route: string;
    readonly status: number;
    readonly statusText: string;
}
export interface ITestRequestOptions {
    body?: fetch.BodyInit;
    headers?: fetch.HeaderInit;
}
export class Test {
    constructor(server: http.Server, method: string, url: string, options: ITestRequestOptions);
    run<T>(): Promise<IApiResponse<T>>;
    end(): void;
}

