import "reflect-metadata";
import { ActionResponse } from "./responses";

const MODULE = Symbol("app:module");
const SERVICE = Symbol("app:service");
const MIGRATION = Symbol("app:migration");
const CONTROLLER = Symbol("app:controller");
const MIDDLEWARES = Symbol("app:middlewares");
const MIDDLEWARE_AUTHENTICATION = Symbol("app:middleware:authentication");
const MIDDLEWARE_RESOLVER = Symbol("app:middleware:resolver");
const MIDDLEWARE_POLICY = Symbol("app:middleware:policies");
const MIDDLEWARE_GENERIC = Symbol("app:middleware:generic");
const ACTIONS = Symbol("controller:actions");
const RESOURCE_ARG = Symbol("resource:args");
const RESOURCE_RESOLVER = Symbol("resource:resolver");
const RESOURCE_VALIDATOR = Symbol("resource:validator");
const RESOURCE_INJECTABLE = Symbol("resource:injectable");

interface ISuiteDefinition<T> {
    readonly Type: TType<T>;
    readonly title: string;
    readonly run: boolean;
}

interface ISuiteFunction<T, U> {
    readonly type: ESuiteFunctionType;
    readonly SuiteType: TType<T>;
    readonly title: string;
    readonly func: (...args: any[]) => U;
    readonly run: boolean;
}

interface ISuiteStub<T, U> {
    readonly SuiteType: TType<T>;
    readonly StubType: TType<U>;
    readonly index: number;
}

interface ISuiteRouter<T> {
    readonly SuiteType: TType<T>;
    readonly index: number;
}

interface IServiceStubDefinition<T, U> {
    readonly RealType: TType<T>;
    readonly StubType: TType<U>;
    instance?: U;
    fakes: sinon.SinonStub<any>[];
}

interface IServiceFakeDefinition<T, U> {
    readonly StubType: TType<T>;
    readonly name: string;
    readonly func: (...args: any[]) => U;
    readonly auto: boolean;
}

export const enum ESuiteFunctionType {
    BEFORE_ALL = "before-all",
    BEFORE_EACH = "before-each",
    AFTER_ALL = "after-all",
    AFTER_EACH = "after-each",
    TEST = "test"
}

export const enum EMiddlewareOrder {
    BEFORE = "before",
    AFTER = "after"
}

export const enum EArgType {
    CONTEXT = "context",
    AUTHENTICATION = "authentication",
    STATE = "state",
    HOST = "host",
    HOSTNAME = "hostname",
    HEADER = "header",
    METHOD = "method",
    ROUTE = "route",
    BODY = "body",
    PARAM = "param",
    QUERY = "query"
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

export const enum EInjectableType {
    INJECTOR = 0,
    HTTP_SERVER = 1
}

export const VALID_REQUEST_METHODS = [
    ERequestMethod.GET,
    ERequestMethod.POST,
    ERequestMethod.PUT,
    ERequestMethod.DELETE
];

export type TMiddlewareHandler<T> = (...args: any[]) => Promise<T>;

export type TActionHandler<T> = (...args: any[]) => Promise<ActionResponse<T>>;

export type TType<T> = new (...args: any[]) => T;

export interface IProviderParameters {
    readonly provides: any;
    readonly service: TType<any>;
}

export interface IModuleParameters {
    readonly route?: string;
    readonly modules?: TType<any>[];
    readonly services?: TType<any>[];
    readonly providers?: IProviderParameters[];
    readonly initialize?: TType<any>[];
    readonly migrations?: TType<any>[];
    readonly controllers?: TType<any>[];
}

export interface IModuleMetadata {
    readonly name: string;
    readonly params: IModuleParameters;
}

export interface IServiceMetadata {
    readonly name: string;
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

export interface IControllerMetadata {
    readonly name: string;
    readonly route: string;
    readonly actions: IActionMetadata[];
}

export interface IActionAuthenticationMetadata {
    readonly service: TType<any>;
    readonly name: string;
    readonly params: any[];
}

export interface IActionAuthorizationMetadata {
    readonly service: TType<any>;
    readonly name: string;
    readonly params: any[];
}

export interface IActionGenericMetadata {
    readonly service: TType<any>;
    readonly order: EMiddlewareOrder;
    readonly name: string;
    readonly params: any[];
}

export interface IResourceArgMetadata {
    readonly type: EArgType;
    readonly index: number;
    readonly name: string;
    readonly required: boolean;
}

export interface IResourceResolverMetadata {
    readonly service: TType<any>;
    readonly index: number;
    readonly name: string;
    readonly optional: boolean;
}

export interface IResourceValidatorMetadata {
    readonly service: TType<any>;
    readonly index: number;
    readonly name: string;
}

export interface IMiddlewareMetadata {
    readonly target: TType<any>;
    readonly type: symbol;
    readonly name: string;
    readonly handler: TMiddlewareHandler<any>;
    readonly args: IResourceArgMetadata[];
    readonly resolvers: IResourceResolverMetadata[];
    readonly validators: IResourceValidatorMetadata[];
}

export interface IActionMetadata {
    readonly target: TType<any>;
    readonly method: ERequestMethod;
    readonly route: string;
    readonly handler: TActionHandler<any>;
    readonly authentication: IActionAuthenticationMetadata[];
    readonly authorization: IActionAuthorizationMetadata[];
    readonly generics: IActionGenericMetadata[];
    readonly args: IResourceArgMetadata[];
    readonly resolvers: IResourceResolverMetadata[];
    readonly validators: IResourceValidatorMetadata[];
}

export function Module(params?: IModuleParameters) {
    return (target: TType<any>): void => {
        AppRegistry.defineModule(target, params);
    };
}

export function Service() {
    return <T>(target: TType<T>): void => {
        AppRegistry.defineService(target);
    };
}

export function Migration(name: string) {
    return <T>(target: TType<T>): void => {
        AppRegistry.defineMigration(target, name);
    };
}

export function Controller(route: string) {
    return <T>(target: TType<T>): void => {
        AppRegistry.defineController(target, route);
    };
}

export function Authentication(name: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineMiddleware(MIDDLEWARE_AUTHENTICATION, target.constructor, name, descriptor.value);
    };
}

export function Resolver(name: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineMiddleware(MIDDLEWARE_RESOLVER, target.constructor, name, descriptor.value);
    };
}

export function Policy(name: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineMiddleware(MIDDLEWARE_POLICY, target.constructor, name, descriptor.value);
    };
}

export function Generic(name: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineMiddleware(MIDDLEWARE_GENERIC, target.constructor, name, descriptor.value);
    };
}

export function Get(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineAction(target.constructor, ERequestMethod.GET, route, descriptor.value);
    };
}

export function Post(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineAction(target.constructor, ERequestMethod.POST, route, descriptor.value);
    };
}

export function Put(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineAction(target.constructor, ERequestMethod.PUT, route, descriptor.value);
    };
}

export function Delete(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineAction(target.constructor, ERequestMethod.DELETE, route, descriptor.value);
    };
}

export function Authenticate<T>(service: TType<T>, name: string, ...params: any[]) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineActionAuthentication(target.constructor, service, name, params, descriptor.value);
    };
}

export function Authorize<T>(service: TType<T>, name: string, ...params: any[]) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineActionAuthorization(target.constructor, service, name, params, descriptor.value);
    };
}

export function Before<T>(service: TType<T>, name: string, ...params: any[]) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineActionGeneric(target.constructor, EMiddlewareOrder.BEFORE, service, name, params, descriptor.value);
    };
}

export function After<T>(service: TType<T>, name: string, ...params: any[]) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        AppRegistry.defineActionGeneric(target.constructor, EMiddlewareOrder.AFTER, service, name, params, descriptor.value);
    };
}

export function Context() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.CONTEXT, handler, index, "context", true);
    };
}

export function State() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.STATE, handler, index, "state", true);
    };
}

export function Host() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.HOST, handler, index, "host", true);
    };
}

export function Hostname() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.HOSTNAME, handler, index, "hostname", true);
    };
}

export function Header(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.HEADER, handler, index, name.toLowerCase(), required === true);
    };
}

export function Method() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.METHOD, handler, index, "method", true);
    };
}

export function Route() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.ROUTE, handler, index, "route", true);
    };
}

export function Body(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.BODY, handler, index, name, required === true);
    };
}

export function Param(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.PARAM, handler, index, name, required === true);
    };
}

export function Query(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceArg(target.constructor, EArgType.QUERY, handler, index, name, required === true);
    };
}

export function Resolve<T>(service: TType<T>, name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceResolver(target.constructor, handler, index, service, name, required === false);
    };
}

export function Validate<T>(service: TType<T>, name: string) {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceValidator(target.constructor, handler, index, service, name);
    };
}

export function Injector() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceInjectable(target, EInjectableType.INJECTOR, index);
    };
}

export function HttpServer() {
    return (target: any, handler: string, index: number): void => {
        AppRegistry.defineResourceInjectable(target, EInjectableType.HTTP_SERVER, index);
    };
}

export function ServiceStub<T>(RealType: TType<T>) {
    return <U>(StubType: TType<U>): void => {
        TestRegistry.declareServiceStub(RealType, StubType);
    };
}

export function Fake(auto?: boolean) {
    return (StubType: any, handler: string, descriptor: PropertyDescriptor): void => {
        TestRegistry.declareServiceStubFake(StubType.constructor, handler, descriptor.value, auto === true);
    };
}

export function TestSuite(title: string, run = true) {
    return <T>(Type: TType<T>): void => {
        TestRegistry.declareTestSuite(Type, title, run);
    };
}

export function Stub<T, U>(StubType: TType<U>) {
    return (SuiteType: TType<T>, handler: string, index: number): void => {
        TestRegistry.declareTestSuiteStub(SuiteType, StubType, index);
    };
}

export function BeforeAll(title: string, run = true) {
    return (StubType: any, handler: string, descriptor: PropertyDescriptor): void => {
        TestRegistry.declareTestSuiteFunc(StubType.constructor, ESuiteFunctionType.BEFORE_ALL, title, descriptor.value, run);
    };
}

export function BeforeEach(title: string, run = true) {
    return (StubType: any, handler: string, descriptor: PropertyDescriptor): void => {
        TestRegistry.declareTestSuiteFunc(StubType.constructor, ESuiteFunctionType.BEFORE_EACH, title, descriptor.value, run);
    };
}

export function AfterAll(title: string, run = true) {
    return (StubType: any, handler: string, descriptor: PropertyDescriptor): void => {
        TestRegistry.declareTestSuiteFunc(StubType.constructor, ESuiteFunctionType.AFTER_ALL, title, descriptor.value, run);
    };
}

export function AfterEach(title: string, run = true) {
    return (StubType: any, handler: string, descriptor: PropertyDescriptor): void => {
        TestRegistry.declareTestSuiteFunc(StubType.constructor, ESuiteFunctionType.AFTER_EACH, title, descriptor.value, run);
    };
}

export function Test(title: string, run = true) {
    return (StubType: any, handler: string, descriptor: PropertyDescriptor): void => {
        TestRegistry.declareTestSuiteFunc(StubType.constructor, ESuiteFunctionType.TEST , title, descriptor.value, run);
    };
}

export function TestRouter<T>() {
    return (SuiteType: TType<T>, handler: string, index: number): void => {
        TestRegistry.declareTestRouter(SuiteType, index);
    };
}

export class AppRegistry {

    public static defineModule<T>(targetModule: TType<T>, params: IModuleParameters): void {
        const metadata: IModuleMetadata = {
            name: targetModule.name,
            params
        };

        // Save target module metadata.
        Reflect.defineMetadata(MODULE, metadata, targetModule);
    }

    public static defineService<T>(targetService: TType<T>): void {
        const middlewares = Reflect.getMetadata(MIDDLEWARES, targetService) as IMiddlewareMetadata[];

        const metadata: IServiceMetadata = {
            name: targetService.name,
            middlewares
        };

        // Save target service metadata.
        Reflect.defineMetadata(SERVICE, metadata, targetService);
    }

    public static defineMigration<T>(targetMigration: TType<T>, name: string): void {
        const metadata: IMigrationMetadata = {
            name
        };

        Reflect.defineMetadata(MIGRATION, metadata, targetMigration);
    }

    public static defineController(targetController: TType<any>, route: string): void {
        const actions = Reflect.getMetadata(ACTIONS, targetController) as IActionMetadata[];

        const metadata: IControllerMetadata = {
            name: targetController.name,
            route,
            actions
        };

        // Save target controller metadata.
        Reflect.defineMetadata(CONTROLLER, metadata, targetController);
    }

    public static defineMiddleware(type: symbol, targetService: TType<any>, name: string, handler: TMiddlewareHandler<any>): void {
        let middlewares = Reflect.getMetadata(MIDDLEWARES, targetService) as IMiddlewareMetadata[];
        if (middlewares === undefined) {
            middlewares = new Array<IMiddlewareMetadata>();
            Reflect.defineMetadata(MIDDLEWARES, middlewares, targetService);
        }

        // Get resource metadata.
        const args = Reflect.getMetadata(RESOURCE_ARG, targetService, handler.name);
        const resolvers = Reflect.getMetadata(RESOURCE_RESOLVER, targetService, handler.name);
        const validators = Reflect.getMetadata(RESOURCE_VALIDATOR, targetService, handler.name);

        const metadata: IMiddlewareMetadata = {
            target: targetService,
            type,
            name,
            handler,
            args: args !== undefined ? args : [],
            resolvers: resolvers !== undefined ? resolvers : [],
            validators: validators !== undefined ? validators : []
        };

        // Add middleware to array.
        middlewares.push(metadata);
    }

    public static defineAction(targetController: TType<any>, method: ERequestMethod, route: string, handler: TActionHandler<any>): void {
        let actions = Reflect.getMetadata(ACTIONS, targetController) as IActionMetadata[];
        if (actions === undefined) {
            actions = new Array<IActionMetadata>();
            Reflect.defineMetadata(ACTIONS, actions, targetController);
        }

        // Get resource metadata.
        const args = Reflect.getMetadata(RESOURCE_ARG, targetController, handler.name);
        const resolvers = Reflect.getMetadata(RESOURCE_RESOLVER, targetController, handler.name);
        const validators = Reflect.getMetadata(RESOURCE_VALIDATOR, targetController, handler.name);

        const metadata: IActionMetadata = {
            target: targetController,
            method,
            route,
            handler,
            authentication: [],
            authorization: [],
            generics: [],
            args: args !== undefined ? args : [],
            resolvers: resolvers !== undefined ? resolvers : [],
            validators: validators !== undefined ? validators : []
        };

        // Add action to array.
        actions.push(metadata);
    }

    public static defineActionAuthentication<T>(
        targetController: TType<any>,
        service: TType<T>,
        name: string,
        params: any[],
        handler: TActionHandler<any>
    ): void {
        const action = this._getActionMetadata(targetController, handler);

        action.authentication.unshift({
            service,
            name,
            params
        });
    }

    public static defineActionAuthorization<T>(
        targetController: TType<any>,
        service: TType<T>,
        name: string,
        params: any[],
        handler: TActionHandler<any>
    ): void {
        const action = this._getActionMetadata(targetController, handler);

        action.authorization.unshift({
            service,
            name,
            params
        });
    }

    public static defineActionGeneric<T>(
        targetController: TType<any>,
        order: EMiddlewareOrder,
        service: TType<T>,
        name: string,
        params: any[],
        handler: TActionHandler<any>
    ): void {
        const action = this._getActionMetadata(targetController, handler);

        action.generics.unshift({
            service,
            order,
            name,
            params
        });
    }

    public static defineResourceArg(
        target: TType<any>,
        type: EArgType,
        handler: string,
        index: number,
        name: string,
        required: boolean
    ): void {
        let args = Reflect.getMetadata(RESOURCE_ARG, target, handler);
        if (args === undefined) {
            args = new Array<IResourceArgMetadata>();
            Reflect.defineMetadata(RESOURCE_ARG, args, target, handler);
        }

        args.unshift({
            type,
            index,
            name,
            required
        });
    }

    public static defineResourceResolver<T>(
        target: TType<any>,
        handler: string,
        index: number,
        service: TType<T>,
        name: string,
        optional: boolean
    ): void {
        let resolvers = Reflect.getMetadata(RESOURCE_RESOLVER, target, handler);
        if (resolvers === undefined) {
            resolvers = new Array<IResourceResolverMetadata>();
            Reflect.defineMetadata(RESOURCE_RESOLVER, resolvers, target, handler);
        }

        resolvers.unshift({
            service,
            index,
            name,
            optional
        });
    }

    public static defineResourceValidator<T>(
        target: TType<any>,
        handler: string,
        index: number,
        service: TType<T>,
        name: string
    ): void {
        let validators = Reflect.getMetadata(RESOURCE_VALIDATOR, target, handler);
        if (validators === undefined) {
            validators = new Array<IResourceValidatorMetadata>();
            Reflect.defineMetadata(RESOURCE_VALIDATOR, validators, target, handler);
        }

        validators.unshift({
            service,
            index,
            name,
        });
    }

    public static defineResourceInjectable(target: TType<any>, type: EInjectableType, index: number): void {
        let injectables = Reflect.getMetadata(RESOURCE_INJECTABLE, target);
        if (injectables === undefined) {
            injectables = new Array<IProviderMetadata>();
            Reflect.defineMetadata(RESOURCE_INJECTABLE, injectables, target);
        }

        injectables.push({
            type,
            index
        });
    }

    public static getInjectableMetadata<T>(targetService: TType<T>): IInjectableMetadata[] {
        return Reflect.getMetadata(RESOURCE_INJECTABLE, targetService);
    }

    public static getModuleMetadata<T>(targetModule: TType<T>): IModuleMetadata {
        return Reflect.getMetadata(MODULE, targetModule);
    }

    public static getServiceMetadata<T>(targetService: TType<T>): IServiceMetadata {
        return Reflect.getMetadata(SERVICE, targetService);
    }

    public static getMigrationMetadata<T>(targetMigration: TType<T>): IMigrationMetadata {
        return Reflect.getMetadata(MIGRATION, targetMigration);
    }

    public static getControllerMetadata<T>(injectedController: TType<T>): IControllerMetadata {
        return Reflect.getMetadata(CONTROLLER, injectedController) as IControllerMetadata;
    }

    public static getAuthenticationMetadata<T>(targetService: TType<T>, name: string): IMiddlewareMetadata {
        return this._getMiddlewareMetadata(MIDDLEWARE_AUTHENTICATION, targetService, name);
    }

    public static getResolverMetadata<T>(targetService: TType<T>, name: string): IMiddlewareMetadata {
        return this._getMiddlewareMetadata(MIDDLEWARE_RESOLVER, targetService, name);
    }

    public static getPolicyMetadata<T>(targetService: TType<T>, name: string): IMiddlewareMetadata {
        return this._getMiddlewareMetadata(MIDDLEWARE_POLICY, targetService, name);
    }

    public static getGenericMetadata<T>(targetService: TType<T>, name: string): IMiddlewareMetadata {
        return this._getMiddlewareMetadata(MIDDLEWARE_GENERIC, targetService, name);
    }

    private static _getActionMetadata<T>(targetController: TType<T>, handler: TActionHandler<any>): IActionMetadata {
        const actions = Reflect.getMetadata(ACTIONS, targetController) as IActionMetadata[];
        const action = actions.find((a: IActionMetadata) => a.handler === handler);
        if (action === undefined) {
            throw new Error(`Action metadata not found for: ${targetController.name}.${handler.name}`);
        }

        return action;
    }

    private static _getMiddlewareMetadata<T>(type: symbol, targetService: TType<T>, name: string): IMiddlewareMetadata {
        // First find the service.
        const serviceMetadata = this.getServiceMetadata(targetService);
        if (serviceMetadata === undefined) {
            throw new Error(`Service metadata not found for: ${targetService.name}`);
        }

        if (serviceMetadata.middlewares === undefined) {
            throw new Error(`Middleware not found: ${targetService.name} [${name}]`);
        }

        // Now find the middleware by name.
        return serviceMetadata.middlewares.find((m: IMiddlewareMetadata) => {
            return m.type === type && m.name === name;
        });
    }

}

export class TestRegistry {

    private static SERVICE_STUBS: IServiceStubDefinition<any, any>[] = [];

    private static SERVICE_STUB_FAKES: IServiceFakeDefinition<any, any>[] = [];

    private static TEST_SUITES: ISuiteDefinition<any>[] = [];

    private static TEST_SUITE_STUBS: ISuiteStub<any, any>[] = [];

    private static TEST_SUITE_ROUTERS: ISuiteRouter<any>[] = [];

    private static TEST_SUITE_FUNCS: ISuiteFunction<any, any>[] = [];

    public static get serviceStubs(): IServiceStubDefinition<any, any>[] {
        return this.SERVICE_STUBS;
    }

    public static get serviceStubFakes(): IServiceFakeDefinition<any, any>[] {
        return this.SERVICE_STUB_FAKES;
    }

    public static get testSuites(): ISuiteDefinition<any>[] {
        return this.TEST_SUITES;
    }

    public static get testSuiteStubs(): ISuiteStub<any, any>[] {
        return this.TEST_SUITE_STUBS;
    }

    public static get testSuiteRouters(): ISuiteRouter<any>[] {
        return this.TEST_SUITE_ROUTERS;
    }

    public static get testSuiteFuncs(): ISuiteFunction<any, any>[] {
        return this.TEST_SUITE_FUNCS;
    }

    public static declareServiceStub<T, U>(RealType: TType<T>, StubType: TType<U>): void {
        this.SERVICE_STUBS.push({
            RealType,
            StubType,
            fakes: []
        });
    }

    public static declareServiceStubFake<T, U>(StubType: TType<T>, name: string, func: (...args: any[]) => U, auto: boolean): void {
        this.SERVICE_STUB_FAKES.push({
            StubType,
            name,
            func,
            auto
        })
    }

    public static declareTestSuite<T>(Type: TType<T>, title: string, run: boolean): void {
        this.TEST_SUITES.push({
            Type,
            title,
            run
        });
    }

    public static declareTestSuiteStub<T, U>(SuiteType: TType<T>, StubType: TType<U>, index: number): void {
        this.TEST_SUITE_STUBS.push({
            SuiteType,
            StubType,
            index
        });
    }

    public static declareTestRouter<T, U>(SuiteType: TType<T>, index: number): void {
        this.TEST_SUITE_ROUTERS.push({
            SuiteType,
            index
        });
    }

    public static declareTestSuiteFunc<T, U>(
        SuiteType: TType<T>,
        funcType: ESuiteFunctionType,
        title: string,
        func: (...args: any[]) => U,
        run: boolean,
    ): void {
        this.TEST_SUITE_FUNCS.push({
            type: funcType,
            SuiteType,
            title,
            func,
            run
        });
    }

}
