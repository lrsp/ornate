import "reflect-metadata";
import { ActionResponse } from "./responses";

const MODULE = Symbol("app:module");
const SERVICE = Symbol("app:service");
const MIGRATION = Symbol("app:migration");
const INJECTABLES = Symbol("service:injectable");
const PROPERTY = Symbol("service:property");
const CONTROLLER = Symbol("app:controller");
const MIDDLEWARES = Symbol("app:middlewares");
const ACTIONS = Symbol("controller:actions");
const ACTION_MIDDLEWARES = Symbol("action:middlewares");
const ACTION_ARGS = Symbol("action:args");
const ACTION_RESOLVE = Symbol("action:resolve");
const ACTION_POLICY = Symbol("action:policy");
const SESSION_RESOURCE = Symbol("session:resource");

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
    AUTHORIZATION = "authorization",
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

export function Module(params?: IModuleParameters) {
    return (target: IType<any>): void => {
        Registry.defineModule(target, params);
    };
}

export function Service() {
    return <T>(target: IType<T>): void => {
        Registry.defineService(target);
    };
}

export function Migration(name: string) {
    return <T>(target: IType<T>): void => {
        Registry.defineMigration(target, name);
    };
}

export function Controller(route: string) {
    return <T>(target: IType<T>): void => {
        Registry.defineController(target, route);
    };
}

export function HttpServer() {
    return (target: any, handler: string, index: number): void => {
        Registry.defineInjectable(target, EInjectableType.HTTP_SERVER, index);
    };
}

export function Middleware(name: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        Registry.defineMiddleware(target.constructor, name, descriptor.value);
    };
}

export function Get(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        Registry.defineAction(target.constructor, ERequestMethod.GET, route, descriptor.value);
    };
}

export function Post(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        Registry.defineAction(target.constructor, ERequestMethod.POST, route, descriptor.value);
    };
}

export function Put(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        Registry.defineAction(target.constructor, ERequestMethod.PUT, route, descriptor.value);
    };
}

export function Delete(route: string) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        Registry.defineAction(target.constructor, ERequestMethod.DELETE, route, descriptor.value);
    };
}

export function Before<T>(service: IType<T>, name: string, ...params: any[]) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        Registry.defineActionMiddleware(target.constructor, EMiddlewareOrder.BEFORE, service, name, params, descriptor.value);
    };
}

export function After<T>(service: IType<T>, name: string, ...params: any[]) {
    return (target: any, handler: string, descriptor: PropertyDescriptor): void => {
        Registry.defineActionMiddleware(target.constructor, EMiddlewareOrder.AFTER, service, name, params, descriptor.value);
    };
}

export function Auth<T>(service: IType<T>, name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineResolver(target.constructor, handler, index, service, name, true, required === false);
    };
}

export function Resolve<T>(service: IType<T>, name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineResolver(target.constructor, handler, index, service, name, false, required === false);
    };
}

export function Policy<T>(service: IType<T>, name: string) {
    return (target: any, handler: string, index: number): void => {
        Registry.definePolicy(target.constructor, handler, index, service, name);
    };
}

export function Session(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineSessionResource(target.constructor, handler, index, name, required === true);
    };
}

export function Req() {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.REQUEST, handler, index, "request", true);
    };
}

export function Res() {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.RESPONSE, handler, index, "response", true);
    };
}

export function Host() {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.HOST, handler, index, "host", true);
    };
}

export function Hostname() {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.HOSTNAME, handler, index, "hostname", true);
    };
}

export function Header(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.HEADER, handler, index, name, required === true);
    };
}

export function Authorization(type: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.AUTHORIZATION, handler, index, type, required === true);
    };
}

export function Body(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.BODY, handler, index, name, required === true);
    };
}

export function Param(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.PARAM, handler, index, name, required === true);
    };
}

export function Query(name: string, required?: boolean) {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.QUERY, handler, index, name, required === true);
    };
}

export function Method() {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.METHOD, handler, index, "method", true);
    };
}

export function Route() {
    return (target: any, handler: string, index: number): void => {
        Registry.defineActionArg(target.constructor, EArgType.ROUTE, handler, index, "route", true);
    };
}

export class Registry {

    public static defineProperty(target: any, name: string, type: EPropertyType): void {
        let properties = Reflect.getMetadata(PROPERTY, target);
        if (properties === undefined) {
            properties = new Array<string>();
            Reflect.defineMetadata(PROPERTY, properties, target);
        }

        const metadata: IPropertyMetadata = {
            type,
            name
        };

        properties.push(metadata);
    }

    public static defineModule<T>(targetModule: IType<T>, params: IModuleParameters): void {
        this._setModuleMetadata(targetModule, params);
    }

    public static defineService<T>(targetService: IType<T>): void {
        const middlewares = Reflect.getMetadata(MIDDLEWARES, targetService) as IMiddlewareMetadata[];
        const properties = Reflect.getMetadata(PROPERTY, targetService) as IPropertyMetadata[];

        this._setServiceMetadata(targetService, properties, middlewares);
    }

    public static defineMigration<T>(targetMigration: IType<T>, name: string): void {
        this._setMigrationMetadata(targetMigration, name);
    }

    public static defineController(targetController: IType<any>, route: string): void {
        const actions = Reflect.getMetadata(ACTIONS, targetController) as IActionMetadata[];

        this._setControllerMetadata(targetController, route, actions);
    }

    public static defineInjectable(target: IType<any>, type: EInjectableType, index: number): void {
        let injectables = Reflect.getMetadata(INJECTABLES, target);
        if (injectables === undefined) {
            injectables = new Array<IProviderMetadata>();
            Reflect.defineMetadata(INJECTABLES, injectables, target);
        }

        this._addInjectableMetadata(injectables, type, index);
    }

    public static defineMiddleware(targetService: IType<any>, name: string, handler: MiddlewareHandler<any>): void {
        let middlewares = Reflect.getMetadata(MIDDLEWARES, targetService) as IMiddlewareMetadata[];
        if (middlewares === undefined) {
            middlewares = new Array<IMiddlewareMetadata>();
            Reflect.defineMetadata(MIDDLEWARES, middlewares, targetService);
        }

        this._addMiddlewareMetadata(middlewares, targetService, name, handler);
    }

    public static defineAction(targetController: IType<any>, method: ERequestMethod, route: string, handler: ActionHandler<any>): void {
        let actions = Reflect.getMetadata(ACTIONS, targetController) as IActionMetadata[];
        if (actions === undefined) {
            actions = new Array<IActionMetadata>();
            Reflect.defineMetadata(ACTIONS, actions, targetController);
        }

        this._addActionMetadata(actions, targetController, method, route, handler);
    }

    public static defineActionMiddleware<T>(
        targetController: IType<any>,
        order: EMiddlewareOrder,
        service: IType<T>,
        name: string,
        params: any[],
        handler: ActionHandler<any>
    ): void {
        let actionMiddlewares = Reflect.getMetadata(ACTION_MIDDLEWARES, targetController, handler.name);
        if (actionMiddlewares === undefined) {
            actionMiddlewares = new Array<IActionMiddlewareMetadata>();
            Reflect.defineMetadata(ACTION_MIDDLEWARES, actionMiddlewares, targetController, handler.name);
        }

        this._addActionMiddlewareMetadata(actionMiddlewares, service, order, name, params);
    }

    public static defineActionArg(target: IType<any>, type: EArgType, handler: string, index: number, name: string, required: boolean): void {
        let actionArgs = Reflect.getMetadata(ACTION_ARGS, target, handler);
        if (actionArgs === undefined) {
            actionArgs = new Array<IActionArgsMetadata>();
            Reflect.defineMetadata(ACTION_ARGS, actionArgs, target, handler);
        }

        this._addActionArgsMetadata(actionArgs, type, index, name, required);
    }

    public static defineResolver<T>(
        target: IType<any>,
        handler: string,
        index: number,
        service: IType<T>,
        name: string,
        auth: boolean,
        optional: boolean
    ): void {
        let actionResolve = Reflect.getMetadata(ACTION_RESOLVE, target, handler);
        if (actionResolve === undefined) {
            actionResolve = new Array<IActionResolveMetadata>();
            Reflect.defineMetadata(ACTION_RESOLVE, actionResolve, target, handler);
        }

        this._addActionResolveMetadata(actionResolve, index, service, name, auth, optional);
    }

    public static definePolicy<T>(target: IType<any>, handler: string, index: number, service: IType<T>, name: string): void {
        let policies = Reflect.getMetadata(ACTION_POLICY, target, handler);
        if (policies === undefined) {
            policies = new Array<IActionPolicyMetadata>();
            Reflect.defineMetadata(ACTION_POLICY, policies, target, handler);
        }

        this._addActionPolicyMetadata(policies, index, service, name);
    }

    public static defineSessionResource(
        target: IType<any>,
        handler: string,
        index: number,
        name: string,
        required: boolean
    ): void {
        let sessionResource = Reflect.getMetadata(SESSION_RESOURCE, target, handler);
        if (sessionResource === undefined) {
            sessionResource = new Array<ISessionResourceMetadata>();
            Reflect.defineMetadata(SESSION_RESOURCE, sessionResource, target, handler);
        }

        this._addSessionResourceMetadata(sessionResource, index, name, required);
    }

    public static getModuleMetadata<T>(targetModule: IType<T>): IModuleMetadata {
        return Reflect.getMetadata(MODULE, targetModule);
    }

    public static getServiceMetadata<T>(targetService: IType<T>): IServiceMetadata {
        return Reflect.getMetadata(SERVICE, targetService);
    }

    public static getMigrationMetadata<T>(targetMigration: IType<T>): IMigrationMetadata {
        return Reflect.getMetadata(MIGRATION, targetMigration);
    }

    public static getControllerMetadata<T>(injectedController: IType<T>): IControllerMetadata {
        return Reflect.getMetadata(CONTROLLER, injectedController) as IControllerMetadata;
    }

    public static getMiddlewareMetadata<T>(targetService: IType<T>, name: string): IMiddlewareMetadata {
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
            return m.name === name;
        });
    }

    public static getActionMiddlewareMetadata<T>(targetController: IType<T>, handler: ActionHandler<any>): IActionMiddlewareMetadata[] {
        const metadata = Reflect.getMetadata(ACTION_MIDDLEWARES, targetController, handler.name) as IActionMiddlewareMetadata[];

        return metadata !== undefined ? metadata : [];
    }

    public static getInjectableMetadata<T>(targetService: IType<T>): IInjectableMetadata[] {
        return Reflect.getMetadata(INJECTABLES, targetService);
    }

    private static _setModuleMetadata<T>(targetModule: IType<T>, params: IModuleParameters): IModuleMetadata {
        const metadata: IModuleMetadata = {
            name: targetModule.name,
            params
        };

        // Save target module metadata.
        Reflect.defineMetadata(MODULE, metadata, targetModule);

        return metadata;
    }

    private static _setServiceMetadata<T>(
        targetService: IType<T>,
        properties: IPropertyMetadata[],
        middlewares: IMiddlewareMetadata[]
    ): IServiceMetadata {
        const metadata: IServiceMetadata = {
            name: targetService.name,
            properties,
            middlewares
        };

        // Save target service metadata.
        Reflect.defineMetadata(SERVICE, metadata, targetService);

        return metadata;
    }

    private static _setMigrationMetadata<T>(targetMigration: IType<T>, name: string): IMigrationMetadata {
        const metadata: IMigrationMetadata = {
            name
        };

        Reflect.defineMetadata(MIGRATION, metadata, targetMigration);

        return metadata;
    }

    private static _setControllerMetadata<T>(targetController: IType<T>, route: string, actions: IActionMetadata[]): IControllerMetadata {
        const metadata: IControllerMetadata = {
            name: targetController.name,
            route,
            actions
        };

        // Save target controller metadata.
        Reflect.defineMetadata(CONTROLLER, metadata, targetController);

        return metadata;
    }

    private static _addInjectableMetadata(injectables: IInjectableMetadata[], type: EInjectableType, index: number): IInjectableMetadata {
        const metadata: IInjectableMetadata = {
            type,
            index
        };

        injectables.push(metadata);

        return metadata;
    }

    private static _addMiddlewareMetadata<T>(
        middlewares: IMiddlewareMetadata[],
        targetService: IType<T>,
        name: string,
        handler: MiddlewareHandler<any>
    ): IMiddlewareMetadata {
        // Add args.
        const args = Reflect.getMetadata(ACTION_ARGS, targetService, handler.name);
        const session = Reflect.getMetadata(SESSION_RESOURCE, targetService, handler.name);

        const metadata: IMiddlewareMetadata = {
            service: targetService.name,
            name,
            handler,
            args: args !== undefined ? args : [],
            session: session !== undefined ? session : []
        };

        // Add middleware to array.
        middlewares.push(metadata);

        return metadata;
    }

    private static _addActionMetadata(
        actions: IActionMetadata[],
        target: IType<any>,
        method: ERequestMethod,
        route: string,
        handler: ActionHandler<any>
    ): IActionMetadata {
        // Add args
        const args = Reflect.getMetadata(ACTION_ARGS, target, handler.name);
        const resolve = Reflect.getMetadata(ACTION_RESOLVE, target, handler.name);
        const policies = Reflect.getMetadata(ACTION_POLICY, target, handler.name);

        const metadata: IActionMetadata = {
            target,
            method,
            route,
            handler,
            args: args !== undefined ? args : [],
            resolve: resolve !== undefined ? resolve : [],
            policies: policies !== undefined ? policies : []
        };

        // Add action to array.
        actions.push(metadata);

        return metadata;
    }

    private static _addActionMiddlewareMetadata<T>(
        actionMiddlewares: IActionMiddlewareMetadata[],
        service: IType<T>,
        order: EMiddlewareOrder,
        name: string,
        params: any[]
    ): IActionMiddlewareMetadata {
        const metadata: IActionMiddlewareMetadata = {
            service,
            order,
            name,
            params
        };

        actionMiddlewares.unshift(metadata);

        return metadata;
    }

    private static _addActionArgsMetadata(
        actionArgs: IActionArgsMetadata[],
        type: EArgType,
        index: number,
        name: string,
        required: boolean
    ): IActionArgsMetadata {
        const metadata: IActionArgsMetadata = {
            type,
            index,
            name,
            required
        };

        actionArgs.unshift(metadata);

        return metadata;
    }

    private static _addActionResolveMetadata<T>(
        resolveMetadata: IActionResolveMetadata[],
        index: number,
        service: IType<T>,
        name: string,
        auth: boolean,
        optional: boolean
    ): IActionResolveMetadata {
        const metadata: IActionResolveMetadata = {
            service,
            index,
            name,
            auth,
            optional
        };

        resolveMetadata.unshift(metadata);

        return metadata;
    }

    private static _addActionPolicyMetadata<T>(
        policies: IActionPolicyMetadata[],
        index: number,
        service: IType<T>,
        name: string
    ): IActionPolicyMetadata {
        const metadata: IActionPolicyMetadata = {
            service,
            index,
            name
        };

        policies.unshift(metadata);

        return metadata;
    }

    private static _addSessionResourceMetadata(
        sessionResources: ISessionResourceMetadata[],
        index: number,
        name: string,
        required: boolean
    ): ISessionResourceMetadata {
        const metadata: ISessionResourceMetadata = {
            index,
            name,
            required
        };

        sessionResources.unshift(metadata);

        return metadata;
    }
}
