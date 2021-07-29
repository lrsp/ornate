import Koa from "koa";
import KoaRouter from "@koa/router";
import KoaBody from "koa-body";
import colors from "ansi-colors";
import sinon from "sinon";
import { AddressInfo } from "net";
import * as util from "util";
import * as http from "http";
import * as httpStatus from "http-status-codes";
import "reflect-metadata";

import {
    AppRegistry,
    TestRegistry,
    TType,
    TActionHandler,
    IModuleMetadata,
    IModuleParameters,
    IProviderParameters,
    IMigrationMetadata,
    IControllerMetadata,
    IMiddlewareMetadata,
    IActionMetadata,
    IActionAuthenticationMetadata,
    IActionAuthorizationMetadata,
    IActionGenericMetadata,
    IResourceArgMetadata,
    EInjectableType,
    EArgType,
    ERequestMethod,
    EMiddlewareOrder,
    ESuiteFunctionType,
    VALID_REQUEST_METHODS
} from "./decorators";

import { ActionResponse, EResponseType } from "./responses";
import { AuthorizationError, ParameterError, AuthenticationError } from "./errors";
import { Test, ITestRouter, IApiResponse, ITestRequestOptions } from "./test";

import * as os from "os";

const DEFAULT_PORT = 80;
const DEFAULT_HOST = "127.0.0.1";

interface IModuleInstance {
    type: TType<any>;
    name: string;
    route: string;
    params: IModuleParameters;
    injector: AppInjector;
    modules: IModuleInstance[];
    services: IServiceInstance[];
    migrations: IMigrationInstance[];
    providers: IProviderInstance[];
    controllers: ControllerInstance[];
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

interface IProviderInstance {
    provides: any;
    type: TType<any>
}

interface IInjectableInstance {
    index: number;
    service: any;
}

interface IControllerHandlers {
    [handler: string]: TActionHandler<any>;
}

interface IControllerType {
    route: string;
}

type ControllerInstance = IControllerType & IControllerHandlers;

interface IHandledKeys {
    readonly params: string[];
    readonly query: string[];
    readonly body: string[];
}

export interface IAuthorizationHeader {
    type: string;
    credentials: string;
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

    private _app: App;

    private _services: Map<TType<any>, IServiceInstance>;
    private _providers: Map<string, IServiceInstance>;
    private _migrations: Map<string, IMigrationInstance>;

    constructor(app: App) {
        this._app = app;

        this._services = new Map<TType<any>, IServiceInstance>();
        this._providers = new Map<string, IServiceInstance>();
        this._migrations = new Map<string, IMigrationInstance>();
    }

    public hasService<T extends IServiceInstance>(target: TType<T>): boolean {
        return this._services.get(target) !== undefined;
    }

    public getService<T extends IServiceInstance>(target: TType<T>): T {
        const instance = this._services.get(target);
        if (instance === undefined) {
            throw new Error(util.format("Service not found: %s", colors.cyan(target.name)));
        }
        return instance as T;
    }

    public getProvider<T extends IServiceInstance>(name: string, ...params: any[]): T {
        let instance = this._providers.get(name);
        if (instance === undefined) {
            // Search all modules for the provider definition.
            const provider = this._app.modules
                .flatMap((m: IModuleInstance) => m.providers)
                .find((p: IProviderInstance) => p.provides === name);

            if (provider === undefined) {
                throw new Error(util.format("Provider not found: %s", colors.cyan(name)));
            }

            instance = this.newProvider(name, provider.type, ...params);
        }
        return instance as T;
    }

    public getMigration<T extends IMigrationInstance>(name: string): T {
        const instance = this._migrations.get(name);
        if (instance === undefined) {
            throw new Error(util.format("Migration not found: %s", colors.cyan(name)));
        }
        return instance as T;
    }

    public getMigrations(): string[] {
        return [...this._migrations.keys()];
    }

    public newService<T extends IServiceInstance>(target: TType<T>): T {
        let instance = this._services.get(target);
        if (instance === undefined) {
            instance = this._newInstance(target);
            this._services.set(target, instance);
        }
        return instance as T;
    }

    public newProvider<T extends IProviderInstance>(name: string, target: TType<T>, ...params: any[]): T {
        const instance = this._newInstance(target, ...params) as T;

        this._providers.set(name, instance);

        return instance;
    }

    public newMigration<T extends IMigrationInstance>(name: string, target: TType<T>): T {
        const instance = this._newInstance(target) as T;

        this._migrations.set(name, instance);

        return instance;
    }

    public newController<T extends ControllerInstance>(target: TType<T>): T {
        return this._newInstance(target) as T;
    }

    private _newInstance<T>(target: TType<T>, ...params: any[]): T {
        // @TODO: This will fail on a circular dependency, with a cryptic error.
        // Detect those by analysing what we're instantiating.
        const paramtypes = Reflect.getOwnMetadata("design:paramtypes", target);

        const constructor = paramtypes === undefined || paramtypes.length === 0
                          ? target
                          : this._inject(target, paramtypes, ...params);

        return new constructor();
    }

    private _inject<T>(target: TType<T>, types: any[], ...params: any[]): TType<T> {
        const injectables = this._resolveInjectables(target);

        // Iterate arguments and replace with injected services (ignoring extra parameters)
        const args = types.slice(0, types.length - params.length)
            .map((f: any, index: number) => {
                // Check if it should be declaratively injected.
                if (injectables.length > 0) {
                    const injectable = injectables.find((i) => {
                        return i.index === index;
                    });

                    if (injectable !== undefined) {
                        return injectable.service;
                    }
                }

                return this.newService(f);
            });

        return target.bind(undefined, ...args, ...params);
    }

    private _resolveInjectables<T>(target: TType<T>): IInjectableInstance[] {
        // Get injectables for this service.
        const injectableMetadata = AppRegistry.getInjectableMetadata(target);
        const injectables = new Array<IInjectableInstance>();
        if (injectableMetadata !== undefined) {
            for (const metadata of injectableMetadata) {
                switch (metadata.type) {
                    case EInjectableType.INJECTOR:
                        injectables.push({index: metadata.index, service: this});

                    case EInjectableType.HTTP_SERVER:
                        injectables.push({index: metadata.index, service: this._app.server});
                        break;
                }
            }
        }

        return injectables;
    }
}

export class App {

    private _koaApp: Koa;
    private _koaRouter: KoaRouter;

    private _httpServer: http.Server;

    private _injector: AppInjector;
    private _modules: IModuleInstance[];

    private _logger: ILogger;

    constructor(params: IAppParams) {
        this._koaApp = new Koa();
        this._koaRouter = new KoaRouter();

        this._injector = new AppInjector(this);
        this._modules = new Array<IModuleInstance>();

        if (params.logger !== undefined) {
            this._logger = params.logger;

        } else {
            this._logger = {
                trace: console.trace,
                debug: console.debug,
                info: console.info,
                warn: console.warn,
                error: console.error
            };
        }

        if (params.parser !== undefined) {
            this._configureBodyParser(params.parser);
        }

        // For health checks.
        this._koaRouter.get("/healthcheck", async (ctx, next) => {
            ctx.status = httpStatus.OK;
            ctx.body = "backend: ok\n";
            await next();
        });

        this._koaApp.use(this._koaRouter.routes());
        this._koaApp.use(this._koaRouter.allowedMethods());

        this._httpServer = http.createServer(this._koaApp.callback());

        for (const targetModule of params.modules) {
            this._registerModule(targetModule, this._injector);
        }
    }

    public get injector(): AppInjector {
        return this._injector;
    }

    public get modules(): IModuleInstance[] {
        return this._modules;
    }

    public get server(): http.Server {
        return this._httpServer;
    }

    public getRouter(): ITestRouter {
        const obj: ITestRouter = {};

        VALID_REQUEST_METHODS
            .map((method: string) => method.toLowerCase())
            .forEach((method: string) => {
                obj[method] = async (url: string, options: ITestRequestOptions): Promise<IApiResponse<any>> => {
                    const test = new Test(this, method, url, options);
                    return test.run();
                }
            });

        return obj;
    }

    public getUrl(name: string, params: {[key: string]: string}, query: {[key: string]: string}): string {
        const url = this._koaRouter.url(name, params, {query});
        if (url as any instanceof Error) {
            throw new ParameterError(util.format("Invalid route: %s", name));
        }

        return url;
    }

    public async run(): Promise<void> {
        await this._startServices();
    }

    public async stop(): Promise<void> {
        await this._stopServices();
    }

    public async close(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this._stopServices();

            this._httpServer.close((err: Error) => {
                if (err !== undefined) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async listen(host: string, port: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {

            this._httpServer.on("listening", async () => {
                const info = this._httpServer.address() as AddressInfo;
                const addresses = this._getAddresses().map((addr: string) => colors.blue(addr));

                this._logger.info("[ornate] Server listening on: [%s] port: %s", addresses.join(", "), colors.bold.white(info.port.toString()));
                resolve();
            });

            this._httpServer.on("error", (err) => {
                this._logger.error("[ornate] Error initialising server: %s", colors.red(err.message));
                reject(err);
            });

            this._httpServer.on("close", () => {
            });

            this._startServices()
                .then(() => {
                    this._httpServer.listen(
                        port !== undefined ? port : DEFAULT_PORT,
                        host !== undefined ? host : DEFAULT_HOST
                    );
                })
                .catch(reject);
        });
    }

    private _getAddresses(): string[] {
        const ifaces = os.networkInterfaces();
        return Object.keys(os.networkInterfaces())
            .flatMap((iname: string) => ifaces[iname])
            .filter((iface: os.NetworkInterfaceInfo) => !iface.internal && iface.family === "IPv4")
            .map((iface: os.NetworkInterfaceInfo) => iface.address);
    }

    private async _startServices(): Promise<void> {
        for (const moduleInstance of this._modules) {
            if (moduleInstance.params.initialize !== undefined) {
                for (const targetService of moduleInstance.params.initialize) {
                    const serviceInstance = moduleInstance.injector.getService(targetService);
                    if (serviceInstance.onInit !== undefined) {
                        try {
                            await serviceInstance.onInit(this);
                        } catch (err) {
                            this._logger.error("[ornate] Error starting service: [%s] %s", colors.cyan(targetService.name), colors.red(err.message));
                            throw err;
                        }
                    }
                }
            }
        }

        this._logger.info(util.format("[ornate] %s", colors.italic.green("All Services started")));
    }

    private async _stopServices(): Promise<void> {
        try {
            for (const m of this._modules) {
                for (const service of m.services) {
                    if (service.onDestroy !== undefined) {
                        await service.onDestroy();
                    }
                }
            }

            this._logger.info(util.format("[ornate] %s", colors.italic.yellow("All Services stopped")));

        } catch (err) {
            this._logger.error("[ornate] Error stopping service: %s", err.message);
            throw err;
        }
    }

    private _configureBodyParser(params: IBodyParserParams): void {

        if (params !== undefined) {
            const options: KoaBody.IKoaBodyOptions = {
                encoding: "utf-8",
                multipart: true,
                urlencoded: params.urlencoded
            };

            if (params.text !== undefined) {
                options.text = true;
                options.textLimit = params.text.limit;
            }

            if (params.json !== undefined) {
                options.json = true;
                options.jsonLimit = params.json.limit;
            }

            this._koaApp.use(KoaBody(options));
        }
    }

    private _registerModule<T>(targetModule: TType<T>, injector: AppInjector, parentModule?: IModuleInstance): void {
        const moduleMetadata = AppRegistry.getModuleMetadata(targetModule) as IModuleMetadata;
        const moduleInstance = new targetModule() as T & IModuleInstance;

        const parentRoute = parentModule !== undefined ? parentModule.route : "";
        const moduleRoute = moduleMetadata.params.route !== undefined ? `${parentRoute}/${moduleMetadata.params.route}` : parentRoute;

        moduleInstance.name = moduleMetadata.name;
        moduleInstance.route = moduleRoute;
        moduleInstance.params = moduleMetadata.params;
        moduleInstance.injector = injector;
        moduleInstance.modules = new Array<IModuleInstance>();
        moduleInstance.services = new Array<IServiceInstance>();
        moduleInstance.migrations = new Array<IMigrationInstance>();
        moduleInstance.providers = new Array<IProviderInstance>();
        moduleInstance.controllers = new Array<ControllerInstance>();

        if (moduleMetadata.params !== undefined && moduleMetadata.params.modules !== undefined) {
            for (const targetSubmodule of moduleMetadata.params.modules) {
                this._registerModule<T>(targetSubmodule, injector, moduleInstance);
            }
        }

        if (moduleMetadata.params !== undefined && moduleMetadata.params.services !== undefined) {
            for (const targetService of moduleMetadata.params.services) {
                this._registerService(moduleInstance, targetService);
            }
        }

        if (moduleMetadata.params !== undefined && moduleMetadata.params.providers !== undefined) {
            for (const targetProvider of moduleMetadata.params.providers) {
                this._registerProvider(moduleInstance, targetProvider);
            }
        }

        if (moduleMetadata.params !== undefined && moduleMetadata.params.migrations !== undefined) {
            for (const targetMigration of moduleMetadata.params.migrations) {
                this._registerMigration(moduleInstance, targetMigration);
            }
        }

        if (moduleMetadata.params !== undefined && moduleMetadata.params.controllers !== undefined) {
            for (const targetController of moduleMetadata.params.controllers) {
                this._registerController(moduleInstance, targetController);
            }
        }

        this._modules.push(moduleInstance);
    }

    private _registerService<T>(
        moduleInstance: IModuleInstance,
        targetService: TType<T>
    ): IServiceInstance {
        // Avoid creating the same service twice.
        const existingService = moduleInstance.services.find((service: IServiceInstance) => {
            return service instanceof targetService;
        });

        if (existingService !== undefined) {
            return existingService;
        }

        const serviceInstance = moduleInstance.injector.newService(targetService);

        this._logger.debug("[ornate] [%s] %s",
            colors.blue(moduleInstance.name),
            colors.magenta(targetService.name)
        );

        moduleInstance.services.push(serviceInstance);

        return serviceInstance;
    }

    private _registerProvider<T>(
        moduleInstance: IModuleInstance,
        provider: IProviderParameters
    ): IProviderInstance {

        const providerInstance: IProviderInstance = {
            provides: provider.provides,
            type: provider.service
        };

        this._logger.debug("[ornate] [%s] %s [%s: %s]",
            colors.blue(moduleInstance.name),
            colors.magenta(provider.service.name),
            colors.italic("provides"),
            colors.magenta(provider.provides)
    );

        moduleInstance.providers.push(providerInstance);

        return providerInstance;
    }

    private _registerMigration<T extends IMigrationInstance>(
        moduleInstance: IModuleInstance,
        targetMigration: TType<T>
    ): void {
        const migrationMetadata = AppRegistry.getMigrationMetadata(targetMigration) as IMigrationMetadata;
        const migrationInstance = moduleInstance.injector.newMigration(migrationMetadata.name, targetMigration);

        this._logger.debug("[ornate] [%s] %s (%s)",
            colors.blue(moduleInstance.name),
            colors.yellow(targetMigration.name),
            colors.green(migrationMetadata.name)
        );

        moduleInstance.migrations.push(migrationInstance);
    }

    private _registerController<T extends ControllerInstance>(
        moduleInstance: IModuleInstance,
        targetController: TType<T>
    ): void {
        const controllerMetadata = AppRegistry.getControllerMetadata(targetController);
        const controllerInstance = moduleInstance.injector.newController(targetController);

        const controllerRoute = controllerMetadata.route !== undefined ? controllerMetadata.route : "";

        controllerInstance.route = `${moduleInstance.route}/${controllerRoute}`;
        this._logger.debug("[ornate] [%s] %s [%s]",
            colors.blue(moduleInstance.name),
            colors.red(controllerMetadata.name),
            colors.yellow(controllerInstance.route)
        );

        if (controllerMetadata.actions !== undefined) {
            for (const action of controllerMetadata.actions) {
                this._registerAction(moduleInstance, controllerMetadata, controllerInstance, action);
            }
        }

        moduleInstance.controllers.push(controllerInstance);
    }

    private _registerAction(
        moduleInstance: IModuleInstance,
        controllerMetadata: IControllerMetadata,
        controllerInstance: ControllerInstance,
        actionMetadata: IActionMetadata
    ): void {
        const actionRoute = actionMetadata.route !== "" ? `${controllerInstance.route}/${actionMetadata.route}` : controllerInstance.route;

        const actionName = `${controllerMetadata.name}.${actionMetadata.handler.name}`;

        const initialise = this._initialiseAction.bind(this, actionMetadata, actionName, actionRoute);
        const authenticationHandlers = this._bindAuthentication(moduleInstance, actionMetadata);
        const authorizationHandlers = this._bindAuthorization(moduleInstance, actionMetadata);
        const beforeHandlers = this._bindGenerics(moduleInstance, actionMetadata, EMiddlewareOrder.BEFORE);
        const afterHandlers = this._bindGenerics(moduleInstance, actionMetadata, EMiddlewareOrder.AFTER);
        const actionHandler = this._bindAction(moduleInstance, actionMetadata, actionName, controllerInstance);

        const handlers: KoaRouter.Middleware[] = [
            initialise,
            ...authenticationHandlers,
            ...authorizationHandlers,
            ...beforeHandlers,
            actionHandler,
            ...afterHandlers
        ];

        switch (actionMetadata.method) {
            case ERequestMethod.GET:
                this._koaRouter.get(actionRoute, actionRoute, ...handlers);
                break;

            case ERequestMethod.PUT:
                this._koaRouter.put(actionRoute, actionRoute, ...handlers);
                break;

            case ERequestMethod.POST:
                this._koaRouter.post(actionRoute, actionRoute, ...handlers);
                break;

            case ERequestMethod.DELETE:
                this._koaRouter.delete(actionRoute, actionRoute, ...handlers);
                break;

            default:
                throw new Error(`[ornate] Unhandled request method: ${actionMetadata.method}`);
        }

        const authentication = actionMetadata.authentication.map((m: IActionAuthenticationMetadata) => colors.white(m.name));
        const authorization = actionMetadata.authorization.map((m: IActionAuthorizationMetadata) => colors.white(m.name));

        this._logger.debug("[ornate] [%s] [%s %s] %s",
            colors.cyan(actionName),
            colors.italic(actionMetadata.method.toLowerCase()),
            colors.yellow(actionRoute),
            [...authentication, ...authorization].join(" · "),
        );
    }

    private async _initialiseAction(
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string,
        context: TAppContext,
        next: Koa.Next
    ): Promise<void> {
        try {
            context.method = actionMetadata.method;
            context.route = actionRoute;

            context.state = {
                authentication: new Map<string, any>()
            };

            await next();

        } catch (err) {
            const code = err.code || httpStatus.INTERNAL_SERVER_ERROR;

            this._logger.error(
                "[ornate] [%s] [%s %s] %s [%d]: %s %s",
                colors.cyan(actionName),
                colors.italic(actionMetadata.method.toLowerCase()),
                colors.yellow(actionRoute),
                colors.red(err.name),
                code,
                err.message,
                err.data !== undefined ? colors.italic(JSON.stringify(err.data)) : ""
            );

            if (code === httpStatus.INTERNAL_SERVER_ERROR) {
                console.error(err);
            }

            context.throw(code, err.message, err.data);
        }
    }

    private _bindAuthentication(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata
    ): KoaRouter.Middleware[] {
        return actionMetadata.authentication.map((authentication: IActionAuthenticationMetadata) => {

            const middleware = AppRegistry.getAuthenticationMetadata(authentication.service, authentication.name);
            if (middleware === undefined) {
                throw new Error(util.format(
                    "[ornate] Authentication metadata not found for: %s (%s)",
                    authentication.service.name,
                    authentication.name)
                );
            }

            return async (context: TAppContext, next: Koa.Next) => {
                // Execute middleware.
                const result = await this._handleMiddleware<boolean>(moduleInstance, middleware, authentication.params, context);

                if (!result) {
                    throw new AuthenticationError(util.format(
                        "[ornate] Authentication required. %s",
                        authentication.name
                    ));
                }

                // Continue with next.
                await next();
            };
        });
    }

    private _bindAuthorization(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata
    ): KoaRouter.Middleware[] {
        return actionMetadata.authorization.map((authorization: IActionAuthorizationMetadata) => {

            const middleware = AppRegistry.getPolicyMetadata(authorization.service, authorization.name);
            if (middleware === undefined) {
                throw new Error(util.format(
                    "[ornate] Policy metadata not found for: %s (%s)",
                    authorization.service.name,
                    authorization.name)
                );
            }

            return async (context: TAppContext, next: Koa.Next) => {
                // Execute middleware.
                const result = await this._handleMiddleware<boolean>(moduleInstance, middleware, authorization.params, context);

                if (!result) {
                    throw new AuthorizationError(util.format(
                        "[ornate] Unauthorised access: %s",
                        authorization.name
                    ));
                }

                // Continue with next.
                await next();
            };
        });
    }

    private _bindGenerics(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata,
        order: EMiddlewareOrder
    ): KoaRouter.Middleware[] {
        return actionMetadata.generics.filter((m: IActionGenericMetadata) => m.order === order)
            .reverse()
            .map((generic: IActionGenericMetadata) => {
            const middleware = AppRegistry.getGenericMetadata(generic.service, generic.name);
            if (middleware === undefined) {
                throw new Error(util.format(
                    "[ornate] Generic metadata not found for: %s (%s)",
                    generic.service.name,
                    generic.name)
                );
            }

            return async (context: TAppContext, next: Koa.Next) => {
                // Execute middleware.
                await this._handleMiddleware(moduleInstance, middleware, generic.params, context);

                // Continue with next.
                await next();
            };
        });
    }

    private _bindAction(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata,
        actionName: string,
        instance: ControllerInstance
    ): KoaRouter.Middleware {
        const handler = actionMetadata.handler.bind(instance);

        return this._handleAction.bind(this, moduleInstance, actionMetadata, actionName, handler);
    }

    private async _handleMiddleware<T>(
        moduleInstance: IModuleInstance,
        metadata: IMiddlewareMetadata,
        params: any[],
        context: TAppContext,
        next?: Koa.Next
    ): Promise<T> {
        const instance = moduleInstance.injector.getService(metadata.target);
        const handler = metadata.handler.bind(instance);

        // Handle middleware arguments.
        const args = this._handleContextArgs(context, metadata.args);

        // Handle middleware resolves.
        await this._handleResourceResolvers(
            moduleInstance,
            metadata,
            context,
            args
        );

        // Execute middleware.
        const result = handler(...args, ...params);

        if (next !== undefined) {
            await next();
        }

        return result;
    }

    private async _handleAction(
        moduleInstance: IModuleInstance,
        metadata: IActionMetadata,
        actionName: string,
        handler: TActionHandler<any>,
        context: TAppContext,
        next: Koa.Next
    ): Promise<void> {
        // Handle action arguments.
        const args = this._handleContextArgs(context, metadata.args);
        const keys = this._handleRequestArgs(context, metadata.args, args);

        // Report unhandled keys.
        this._reportUnhandledKeys(actionName, keys, context);

        // Handle resource resolvers.
        await this._handleResourceResolvers(
            moduleInstance,
            metadata,
            context,
            args
        );

        // Handle resource validators.
        await this._handleResourceValidators(
            moduleInstance,
            metadata,
            context,
            args
        );

        // Execute action.
        const result = await handler(...args) as ActionResponse<any>;

        if (result.status === httpStatus.MOVED_TEMPORARILY) {
            context.redirect(result.data);
        }

        // Set status.
        context.status = result.status;

        // Set direct response headers.
        if (result !== undefined && result.headers !== undefined) {
            Object.keys(result.headers).map((key) => {
                context.set(key, result.headers[key]);
            });
        }

        if (result === undefined || result.data === undefined) {
            // Return now.
            return next();
        }

        // Send data.
        switch (result.type) {
            case EResponseType.RAW:
                context.response.type = "application/octet-stream";
                break;

            case EResponseType.TEXT:
                context.response.type = "text/plain";
                break;

            case EResponseType.JSON:
                context.response.type = "application/json";
                break;
        }

        context.response.body = result.data;

        await next();
    }

    private _handleContextArgs(context: TAppContext, argsMetadata: IResourceArgMetadata[]): any[] {
        const args = new Array<any>();

        const contextKey = argsMetadata.find((am: IResourceArgMetadata) => am.type === EArgType.CONTEXT);
        const stateKey = argsMetadata.find((am: IResourceArgMetadata) => am.type === EArgType.STATE);
        const hostKey = argsMetadata.find((am: IResourceArgMetadata) => am.type === EArgType.HOST);
        const hostnameKey = argsMetadata.find((am: IResourceArgMetadata) => am.type === EArgType.HOSTNAME);
        const methodKey = argsMetadata.find((am: IResourceArgMetadata) => am.type === EArgType.METHOD);
        const routeKey = argsMetadata.find((am: IResourceArgMetadata) => am.type === EArgType.ROUTE);

        const headerKeys = argsMetadata.filter((am: IResourceArgMetadata) => am.type === EArgType.HEADER);

        if (contextKey !== undefined) {
            args[contextKey.index] = context;
        }
        if (stateKey !== undefined) {
            args[stateKey.index] = context.state;
        }
        if (hostKey !== undefined) {
            args[hostKey.index] = `${context.protocol}://${context.host}`;
        }
        if (hostnameKey !== undefined) {
            args[hostnameKey.index] = context.hostname;
        }
        if (methodKey !== undefined) {
            args[methodKey.index] = context.method;
        }
        if (routeKey !== undefined) {
            args[routeKey.index] = context.route;
        }

        this._handleRequestSource(context.headers, headerKeys, args);

        return args;
    }

    private _handleRequestArgs(context: TAppContext, argsMetadata: IResourceArgMetadata[], args: any[]): IHandledKeys {
        const paramKeys = argsMetadata.filter((am: IResourceArgMetadata) => am.type === EArgType.PARAM);
        const queryKeys = argsMetadata.filter((am: IResourceArgMetadata) => am.type === EArgType.QUERY);
        const bodyKeys = argsMetadata.filter((am: IResourceArgMetadata) => am.type === EArgType.BODY);

        const handledParamKeys = this._handleRequestSource(context.params, paramKeys, args);
        const handledQueryKeys = this._handleRequestSource(context.query, queryKeys, args);
        const handledBodyKeys = this._handleRequestSource((context.request as any).body, bodyKeys, args);

        return {
            params: handledParamKeys,
            query: handledQueryKeys,
            body: handledBodyKeys
        };
    }

    private async _handleResourceResolvers(
        moduleInstance: IModuleInstance,
        metadata: IMiddlewareMetadata | IActionMetadata,
        context: TAppContext,
        args: any[]
    ): Promise<void> {
        for (const resolve of metadata.resolvers) {
            const resolver = AppRegistry.getResolverMetadata(resolve.service, resolve.name);
            if (resolver === undefined) {
                throw new ParameterError(util.format(
                    "[ornate] Resolver metadata not found for: %s (%s)",
                    resolve.service.name,
                    resolve.name
                ));
            }

            // Call middleware.
            const result = await this._handleMiddleware<any>(moduleInstance, resolver, [args[resolve.index]], context);

            // Update args based on resolve index.
            args[resolve.index] = result;
        }
    }

    private async _handleResourceValidators(
        moduleInstance: IModuleInstance,
        metadata: IMiddlewareMetadata | IActionMetadata,
        context: TAppContext,
        args: any[]
    ): Promise<void> {
        for (const validator of metadata.validators) {
            const policy = AppRegistry.getPolicyMetadata(validator.service, validator.name);
            if (policy === undefined) {
                throw new ParameterError(util.format(
                    "[ornate] Validator policy metadata not found for: %s (%s)",
                    validator.service.name,
                    validator.name
                ));
            }

            // Call middleware.
            const result = await this._handleMiddleware<boolean>(moduleInstance, policy, [args[validator.index]], context);

            if (!result) {
                throw new AuthorizationError(util.format(
                    "[ornate] Unauthorized resource access. Policy: %s",
                    validator.name
                ));
            }
        }
    }

    private _handleRequestSource(
        source: {[key: string]: string | string[]},
        argsMetadata: IResourceArgMetadata[],
        args: any[]
    ): string[] {
        // Store the handled keys here.
        const keys = new Array<string>();

        if (argsMetadata.length === 0) {
            return keys;
        }

        // First, set the defined ones.
        for (const argMetadata of argsMetadata) {
            if (argMetadata.required && source[argMetadata.name] === undefined) {
                throw new ParameterError(util.format("[ornate] Required %s argument not found: %s", argMetadata.type, argMetadata.name));
            }

            args[argMetadata.index] = source[argMetadata.name];

            keys.push(argMetadata.name);
        }

        return keys;
    }

    private _reportUnhandledKeys(action: string, keys: IHandledKeys, context: TAppContext): void {
        const paramsKeys = Object.keys(context.params).filter((key) => keys.params.indexOf(key) === -1);
        const queryKeys = Object.keys(context.query).filter((key) => keys.query.indexOf(key) === -1);
        const bodyKeys = Object.keys((context.request as any).body).filter((key) => keys.body.indexOf(key) === -1);

        paramsKeys.forEach((key) => this._logger.warn("[ornate] Action: %s detected unhandled url parameter: %s", action, key));
        queryKeys.forEach((key) => this._logger.warn("[ornate] Action: %s detected unhandled query parameter: %s", action, key));
        bodyKeys.forEach((key) => this._logger.warn("[ornate] Action: %s detected unhandled body parameter: %s", action, key));
    }
}

export class TestRunner {

    private _app: App;

    constructor(app: App) {
        this._app = app;

        this._initializeStubs();
        this._configureSuites();
    }

    public async run(): Promise<void> {
        await this._app.run();
    }

    public async stop(): Promise<void> {
        await this._app.stop();
    }

    private _initializeStubs(): void {
        for (const stub of TestRegistry.serviceStubs) {
            stub.instance = this._getStubInstance(stub.StubType);

            TestRegistry.serviceStubFakes
                .filter((sf) => sf.StubType === stub.StubType && sf.auto)
                .forEach((sf) => this._stubFunction(stub.RealType, stub.instance, sf.name, sf.func));
        }
    }

    private _configureSuites(): void {
        for (const suite of TestRegistry.testSuites.filter((s) => s.run)) {
            const instance = this._newTestSuiteInstance(suite.Type);

            describe(suite.title, () => {
                // Stub suite fakes.
                before(() => {
                    TestRegistry.testSuiteStubs
                        .filter((ss) => ss.SuiteType === suite.Type)
                        .map((ss) => ss.StubType)
                        .forEach((StubType) => this._stub(StubType));
                });

                after(() => {
                    TestRegistry.testSuiteStubs
                        .filter((ss) => ss.SuiteType === suite.Type)
                        .map((ss) => ss.StubType)
                        .forEach((StubType) => this._restore(StubType))
                });

                TestRegistry.testSuiteFuncs
                    .filter((sf) => sf.SuiteType === suite.Type && sf.type === ESuiteFunctionType.BEFORE_ALL && sf.run)
                    .forEach((f) => before(f.title, f.func.bind(instance)));

                TestRegistry.testSuiteFuncs
                    .filter((sf) => sf.SuiteType === suite.Type && sf.type === ESuiteFunctionType.AFTER_ALL && sf.run)
                    .forEach((f) => after(f.title, f.func.bind(instance)));

                TestRegistry.testSuiteFuncs
                    .filter((sf) => sf.SuiteType === suite.Type && sf.type === ESuiteFunctionType.BEFORE_EACH && sf.run)
                    .forEach((f) => beforeEach(f.title, f.func.bind(instance)));

                TestRegistry.testSuiteFuncs
                    .filter((sf) => sf.SuiteType === suite.Type && sf.type === ESuiteFunctionType.AFTER_EACH && sf.run)
                    .forEach((f) => afterEach(f.title, f.func.bind(instance)));

                TestRegistry.testSuiteFuncs
                    .filter((sf) => sf.SuiteType === suite.Type && sf.type === ESuiteFunctionType.TEST && sf.run)
                    .forEach((f) => it(f.title, f.func.bind(instance)));
            });
        }
    }

    private _stub<T>(StubType: TType<T>): void {
        const stub = TestRegistry.serviceStubs.find((ss) => ss.StubType === StubType);

        if (stub === undefined) {
            throw new Error(`No stub definition found for: ${StubType.constructor.name}`);
        }

        // Stub all non-auto functions (as they're already stubbed).
        TestRegistry.serviceStubFakes
            .filter((sf) => sf.StubType === StubType && !sf.auto)
            .map((sf) => this._stubFunction(stub.RealType, stub.instance, sf.name, sf.func))
            .forEach((func) => stub.fakes.push(func));
    }

    private _restore<T>(StubType: TType<T>): void {
        const stub = TestRegistry.serviceStubs.find((ss) => ss.StubType === StubType);

        if (stub === undefined) {
            throw new Error(`No stub definition found for: ${StubType.constructor.name}`);
        }

        for (const fake of stub.fakes) {
            fake.restore();
        }

        stub.fakes = [];
    }

    private _stubFunction<T, U, V>(RealType: TType<T>, instance: U, name: string, func: (...args: any[]) => V): sinon.SinonStub<any> {
        return sinon.stub(RealType.prototype, name).callsFake(func.bind(instance));
    }

    private _getStubInstance<T>(StubType: TType<T>): T {
        const stub = TestRegistry.serviceStubs.find((ss) => ss.StubType === StubType);

        if (stub === undefined) {
            throw new Error(`No stub definition found for: ${StubType.constructor.name}`);
        }

        if (stub.instance === undefined) {
            stub.instance = this._newStubInstance(StubType);
        }

        return stub.instance;
    }

    private _newStubInstance<T>(StubType: TType<T>): T {
        const params = Reflect.getOwnMetadata("design:paramtypes", StubType);

        const constructor = params === undefined || params.length === 0 ? StubType : this._injectStubs(StubType, params);

        return new constructor();
    }

    private _injectStubs<T>(StubType: TType<T>, params: any[]): TType<T> {
        const args = params.map((f: any, index: number) => {
            const stub = this._getStubInstance(f);
            if (stub !== undefined) {
                return stub;
            }

            throw new Error(util.format("Invalid Stub constructor parameter: %s", f));
        });

        return StubType.bind(undefined, ...args);
    }

    private _newTestSuiteInstance<T>(SuiteType: TType<T>): T {
        const params = Reflect.getOwnMetadata("design:paramtypes", SuiteType);

        const constructor = params === undefined || params.length === 0 ? SuiteType : this._injectServices(SuiteType, params);

        return new constructor();
    }

    private _injectServices<T>(SuiteType: TType<T>, params: any[]): TType<T> {
        const router = TestRegistry.testSuiteRouters.find((tr) => tr.SuiteType === SuiteType);

        const args = params.map((f: any, index: number) => {
            if (router !== undefined && router.index === index) {
                return this._app.getRouter();
            }

            const module = this._app.modules.find((m: IModuleInstance) => m.injector.hasService(f));
            if (module !== undefined) {
                return module.injector.getService(f);
            }

            throw new Error(util.format("Could not resolve Test Suite constructor parameter: %s", f));
        });

        return SuiteType.bind(undefined, ...args);
    }

}
