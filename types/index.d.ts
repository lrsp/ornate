/// <reference types="node" />

import * as http from "http";
import * as fetch from "node-fetch";
import Koa from "koa";
import KoaRouter from "koa-router";
import KoaBody from "koa-body";
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
    constructor(status: number, type: EResponseType, data: T, headers: IResponseHeaders, next?: boolean);
    readonly status: number;
    readonly type: EResponseType;
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
export const enum ESuiteFunctionType {
    BEFORE_ALL = "before-all",
    AFTER_ALL = "after-all",
    TEST = "test"
}
export const enum EMiddlewareOrder {
    BEFORE = "before",
    AFTER = "after"
}
export const enum EArgType {
    CONTEXT = "context",
    HOST = "host",
    HOSTNAME = "hostname",
    HEADER = "header",
    HEADER_AUTHORIZATION = "header-authorization",
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
export type TType<T> = new (...args: any[]) => T;
export type TActionHandler<T> = (...args: any[]) => Promise<ActionResponse<T>>;
export type TMiddlewareHandler<T> = (...args: any[]) => Promise<T>;
export interface IProviderParameters {
    readonly provides: any;
    readonly service: TType<any>;
}
export interface IModuleParameters {
    readonly route?: string;
    readonly modules?: AnyType[];
    readonly services?: AnyType[];
    readonly initialize?: AnyType[];
    readonly migrations?: AnyType[];
    readonly providers?: IProviderParameters[];
    readonly controllers?: AnyType[];
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
    readonly target: string;
    readonly name: string;
    readonly handler: MiddlewareHandler<any>;
    readonly args: IActionArgsMetadata[];
}
export interface IControllerMetadata {
    readonly name: string;
    readonly route: string;
    readonly actions: IActionMetadata[];
}
export interface IActionMetadata {
    readonly target: TType<any>;
    readonly method: ERequestMethod;
    readonly route: string;
    readonly handler: ActionHandler<any>;
    readonly authentication: IActionAuthenticationMetadata[];
    readonly authorization: IActionAuthorizationMetadata[];
    readonly args: IActionArgsMetadata[];
    readonly resolve: IActionResolveMetadata[];
    readonly policies: IActionPolicyMetadata[];
}
export interface IActionMiddlewareMetadata {
    readonly service: TType<any>;
    readonly order: EMiddlewareOrder;
    readonly name: string;
    readonly params: any[];
}
export interface IActionAuthenticateMetadata {
    readonly service: TType<any>;
    readonly name: string;
    readonly params: any[];
}
export interface IActionAuthorizationMetadata {
    readonly service: TType<any>;
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
    readonly service: TType<any>;
    readonly index: number;
    readonly name: string;
    readonly optional: boolean;
}
export interface IActionPolicyMetadata {
    readonly service: TType<any>;
    readonly index: number;
    readonly name: string;
}
export function Module(params?: IModuleParameters): (target: TType<any>) => void;
export function Service(): <T>(target: TType<T>) => void;
export function Migration(name: string): <T>(target: TType<T>) => void;
export function Controller(route: string): <T>(target: TType<T>) => void;
export function Injector(): (target: any, handler: string, index: number) => void;
export function HttpServer(): (target: any, handler: string, index: number) => void;
export function Authentication(name: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Resolver(name: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Policy(name: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Generic(name: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Get(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Post(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Put(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Delete(route: string): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Authenticate<T>(service: TType<T>, name: string, ...params: any[]): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Authorize<T>(service: TType<T>, name: string, ...params: any[]): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Before<T>(service: TType<T>, name: string, ...params: any[]): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function After<T>(service: TType<T>, name: string, ...params: any[]): (target: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Resolve<T>(service: TType<T>, name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Validate<T>(service: TType<T>, name: string): (target: any, handler: string, index: number) => void;
export function Context(): (target: any, handler: string, index: number) => void;
export function State(): (target: any, handler: string, index: number) => void;
export function Host(): (target: any, handler: string, index: number) => void;
export function Hostname(): (target: any, handler: string, index: number) => void;
export function Header(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Method(): (target: any, handler: string, index: number) => void;
export function Route(): (target: any, handler: string, index: number) => void;
export function Body(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Param(name: string, required?: boolean): (target: any, handler: string, index: number) => void;
export function Query(name: string, required?: boolean): (target: any, handler: string, index: number) => void;

export function ServiceStub<T>(RealType: TType<T>): <U>(StubType: TType<U>) => void;
export function Fake(auto?: boolean): (StubType: any, handler: string, descriptor: PropertyDescriptor) => void;
export function TestSuite(title: string, run = true): <T>(Type: TType<T>) => void;
export function Stub<T, U>(StubType: TType<U>): (SuiteType: TType<T>, handler: string, index: number) => void;
export function TestRouter<T>(): (SuiteType: TType<T>, handler: string, index: number) => void;
export function BeforeAll(title: string, run = true): (StubType: any, handler: string, descriptor: PropertyDescriptor) => void;
export function BeforeEach(title: string, run = true): (StubType: any, handler: string, descriptor: PropertyDescriptor) => void;
export function AfterAll(title: string, run = true): (StubType: any, handler: string, descriptor: PropertyDescriptor) => void;
export function AfterEach(title: string, run = true): (StubType: any, handler: string, descriptor: PropertyDescriptor) => void;
export function Test(title: string, run = true): (StubType: any, handler: string, descriptor: PropertyDescriptor) => void;


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
    readonly text?: {limit: string | number};
    readonly json?: {limit: string | number};
    readonly urlencoded?: boolean;
}
export interface IAppParams {
    readonly logger?: ILogger;
    readonly modules: TType<any>[];
    readonly parser?: IBodyParserParams;
}
export interface IAppContext {
    method: ERequestMethod;
    route: string;
}
export type TAppContext = KoaRouter.RouterContext<any, IAppContext>;
export class AppInjector {
    getService<T extends IServiceInstance>(target: TType<T>): T;
    getProvider<T extends IServiceInstance>(name: string, ...params: any[]): T
    getMigration<T extends IMigrationInstance>(name: string): T;
    getMigrations(): string[];
}
export class App {
    readonly injector: AppInjector;
    constructor(params: IAppParams);
    getRouter(): {
        [type: string]: (url: string, options?: ITestRequestOptions) => Test;
    };
    run(): Promise<void>;
    stop(): Promise<void>;
    close(): Promise<void>;
    listen(host: string, port: number): Promise<void>;
}
export class TestRunner {
    constructor(app: App);
    run(): Promise<void>;
    stop(): Promise<void>;
}
export interface IApiResponse<T> {
    headers: IHttpHeaders;
    body: T;
}
export interface ITestRequestOptions {
    body?: fetch.BodyInit;
    params?: {[param: string]: string};
    query?: {[param: string]: string};
    headers?: fetch.HeaderInit;
}
export class TestError extends Error {
    constructor(route: string, status: number, statusText: string, message: string);
    readonly route: string;
    readonly status: number;
    readonly statusText: string;
}
export interface ITestRouter {
    [method: string]: <T>(url: string, options?: ITestRequestOptions) => Promise<IApiResponse<T>>;
}
export class Test<T> {
    constructor(server: http.Server, method: string, url: string, options: ITestRequestOptions);
    run(): Promise<IApiResponse<T>>;
}

