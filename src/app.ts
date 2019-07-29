
import express from "express";
import methodOverride from "method-override";
import colors from "ansi-colors";
import { AddressInfo } from "net";
import * as util from "util";
import * as bodyParser from "body-parser";
import * as http from "http";
import * as httpStatus from "http-status-codes";
import "reflect-metadata";

import {
    IType,
    EInjectableType,
    EPropertyType,
    ERequestMethod,
    Registry,
    EMiddlewareOrder,
    EArgType,
    IModuleMetadata,
    IModuleParameters,
    IServiceMetadata,
    IMigrationMetadata,
    IControllerMetadata,
    IMiddlewareMetadata,
    IActionMetadata,
    IActionMiddlewareMetadata,
    IActionAuthMetadata,
    IActionResourceMetadata,
    IActionPolicyMetadata,
    IActionArgsMetadata,
    ActionHandler,
    MiddlewareHandler
} from "./decorators";

import { ActionResponse } from "./responses";
import { AppError, ParameterError, AuthenticationError, AuthorizationError } from "./errors";
import { Test, ITestRequestOptions } from "./test";

import * as os from "os";

const DEFAULT_PORT = 80;
const DEFAULT_HOST = "127.0.0.1";

interface IModuleInstance {
    name: string;
    route: string;
    params: IModuleParameters;
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
    service: IServiceInstance;
}

interface IInjectableInstance {
    index: number;
    service: any;
}

interface IControllerHandlers {
    [handler: string]: ActionHandler<any>;
}

interface IControllerType {
    route: string;
}

type ControllerInstance = IControllerType & IControllerHandlers;

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

export interface IAuthenticatedUser {
    readonly id?: string;
    readonly name: string;
    readonly roles: string[];
}

export interface IAuthentication {
    readonly user: IAuthenticatedUser;
}

export interface IAuthorizationService {
    findRoutePermissions(method: ERequestMethod, path: string): IPermission[];
    checkRoutePermissions(auth: IAuthentication[], method: ERequestMethod, path: string): Promise<boolean>;
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
    readonly auth?: IAuthorizationService;
    readonly logger?: ILogger;
    readonly modules: Array<IType<any>>;
    readonly parser?: IBodyParserParams;
}

export interface IAppRequest extends express.Request {
    args: any[];
    auth: Map<string, IAuthentication>;
    resolved: Map<string, any>;
}

export type AppResponse = express.Response;

export class App {

    private _expressApp: express.Application;
    private _expressRouter: express.Router;
    private _httpServer: http.Server;

    private _modules: IModuleInstance[];

    private _auth: IAuthorizationService;
    private _logger: ILogger;

    private MODULES = new Map<IType<any>, any>();
    private SERVICES = new Map<IType<any>, IServiceInstance>();
    private MIGRATIONS = new Map<string, IMigrationInstance>();

    constructor(params: IAppParams) {
        this._modules = new Array<IModuleInstance>();

        this._expressApp = express();
        this._expressRouter = express.Router();

        this._auth = params.auth;

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

        this._expressApp.enable("trust proxy");
        this._expressApp.use(methodOverride());
        this._expressApp.use(this._expressRouter);

        this._httpServer = http.createServer(this._expressApp);

        for (const targetModule of params.modules) {
            this._registerModule(targetModule);
        }

        // For health checks.
        this._expressRouter.use("/healthcheck", (req, res, next) => {
            res.status(httpStatus.OK).send("backend: ok\n");
            next();
        });
    }

    public getModule<T>(target: IType<T>): T {
        const instance = this.MODULES.get(target);
        if (instance === undefined) {
            throw new Error(util.format("Module not found: %s", colors.cyan(target.name)));
        }
        return instance;
    }

    public getService<T extends IServiceInstance>(target: IType<T>): T {
        const instance = this.SERVICES.get(target);
        if (instance === undefined) {
            throw new Error(util.format("Service not found: %s", colors.cyan(target.name)));
        }
        return instance as T;
    }

    public getMigrations(): string[] {
        return Array.from(this.MIGRATIONS.keys());
    }

    public getMigration<T extends IMigrationInstance>(name: string): T {
        const instance = this.MIGRATIONS.get(name);
        if (instance === undefined) {
            throw new Error(util.format("Migration not found: %s", colors.cyan(name)));
        }
        return instance as T;
    }

    public getRouter(): {[type: string]: (url: string, options?: ITestRequestOptions) => Test} {
        const obj: {[type: string]: (url: string, options: ITestRequestOptions) => Test} = {};
        http.METHODS
            .map((method: string) => method.toLowerCase())
            .forEach((method: string) => {
                obj[method] = (url: string, options: ITestRequestOptions) => new Test(this._httpServer, method, url, options);
            });
        return obj;
    }

    public async run(): Promise<void> {
        await this._startServices();
    }

    public async stop(): Promise<void> {
        await this._stopServices();
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
                    const serviceInstance = this._getServiceInstance(moduleInstance, targetService);
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
            if (params.raw !== undefined) {
                this._expressApp.use(bodyParser.raw(params.raw));
            }

            if (params.text !== undefined) {
                this._expressApp.use(bodyParser.text(params.text));
            }

            if (params.json !== undefined) {
                this._expressApp.use(bodyParser.json(params.json));
            }

            if (params.urlencoded !== undefined) {
                this._expressApp.use(bodyParser.urlencoded(params.urlencoded));
            }
        }
    }

    private _registerModule<T>(targetModule: IType<T>, parentModule?: IModuleInstance): void {
        const moduleMetadata = Registry.getModuleMetadata(targetModule) as IModuleMetadata;
        const moduleInstance = this._getModuleInstance(targetModule) as IModuleInstance;

        const parentRoute = parentModule !== undefined ? parentModule.route : "";
        const moduleRoute = moduleMetadata.params.route !== undefined ? `${parentRoute}/${moduleMetadata.params.route}` : parentRoute;

        moduleInstance.name = moduleMetadata.name;
        moduleInstance.route = moduleRoute;
        moduleInstance.params = moduleMetadata.params;
        moduleInstance.modules = new Array<IModuleInstance>();
        moduleInstance.services = new Array<IServiceInstance>();
        moduleInstance.migrations = new Array<IMigrationInstance>();
        moduleInstance.providers = new Array<IProviderInstance>();
        moduleInstance.controllers = new Array<ControllerInstance>();

        this._logger.debug("[ornate] + Module: %s [%s]", colors.blue(moduleMetadata.name), colors.white(moduleInstance.route));

        if (moduleMetadata.params !== undefined && moduleMetadata.params.modules !== undefined) {
            for (const targetSubmodule of moduleMetadata.params.modules) {
                this._registerModule<T>(targetSubmodule, moduleInstance);
            }
        }

        if (moduleMetadata.params !== undefined && moduleMetadata.params.providers !== undefined) {
            for (const provider of moduleMetadata.params.providers) {
                this._registerProvider(moduleInstance, provider.provides, provider.service);
            }
        }

        if (moduleMetadata.params !== undefined && moduleMetadata.params.services !== undefined) {
            for (const targetService of moduleMetadata.params.services) {
                this._registerService(moduleInstance, targetService);
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

    private _registerProvider<T>(moduleInstance: IModuleInstance, provides: any, targetService: IType<T>): IProviderInstance {
        const service = this._registerService(moduleInstance, targetService, provides);

        const providerInstance: IProviderInstance = {
            provides,
            service
        };

        moduleInstance.providers.push(providerInstance);

        return providerInstance;
    }

    private _registerService<T>(moduleInstance: IModuleInstance, targetService: IType<T>, provides?: any): IServiceInstance {
        // Avoid creating the same service twice.
        const existingService = moduleInstance.services.find((service: IServiceInstance) => {
            return service instanceof targetService;
        });

        if (existingService !== undefined) {
            return existingService;
        }

        const serviceMetadata = Registry.getServiceMetadata(targetService) as IServiceMetadata;
        const serviceInstance = this._getServiceInstance(moduleInstance, targetService);

        this._logger.debug("[ornate] - Service: [%s] %s %s",
            colors.blue(moduleInstance.name),
            colors.magenta(targetService.name),
            provides !== undefined ? `[${colors.italic("provides")}: ${colors.magenta(provides.name)}]` : ""
        );

        // Inject properties.
        if (serviceMetadata.properties !== undefined) {
            for (const property of serviceMetadata.properties) {
                switch (property.type) {
                    case EPropertyType.HTTP_SERVER:
                        serviceInstance[property.name] = this._httpServer;
                        break;
                }
            }
        }

        moduleInstance.services.push(serviceInstance);

        return serviceInstance;
    }

    private _registerMigration<T>(moduleInstance: IModuleInstance, targetMigration: IType<T>): void {
        const migrationMetadata = Registry.getMigrationMetadata(targetMigration) as IMigrationMetadata;

        // Ensure there are no duplicates.
        const existingMigration = this.MIGRATIONS.get(migrationMetadata.name);
        if (existingMigration !== undefined) {
            this._logger.warn(
                "[ornate] - Migration: [%s] %s (%s already exists)",
                colors.blue(moduleInstance.name),
                colors.yellow(targetMigration.name),
                colors.red(migrationMetadata.name)
            );
            return;
        }

        const migrationInstance = this._getMigrationInstance(moduleInstance, migrationMetadata.name, targetMigration);

        this._logger.debug("[ornate] - Migration: [%s] %s (%s)",
            colors.blue(moduleInstance.name),
            colors.yellow(targetMigration.name),
            colors.green(migrationMetadata.name)
        );

        moduleInstance.migrations.push(migrationInstance);
    }

    private _registerController<T>(moduleInstance: IModuleInstance, targetController: IType<T>): void {
        const controllerMetadata = Registry.getControllerMetadata(targetController);
        const controllerInstance = this._newInstance(moduleInstance, targetController) as ControllerInstance;

        const controllerRoute = controllerMetadata.route !== undefined ? controllerMetadata.route : "";

        controllerInstance.route = `${moduleInstance.route}/${controllerRoute}`;
        this._logger.debug("[ornate] - Controller: [%s] %s [%s]",
            colors.blue(moduleInstance.name),
            colors.red(controllerMetadata.name),
            colors.white(controllerInstance.route)
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
        const checkPermissions = this._checkPermissions.bind(this, moduleInstance, actionMetadata, actionName, actionRoute);
        const authHandlers = this._bindAuthResolvers(moduleInstance, actionMetadata, actionName, actionRoute);
        const resolveHandlers = this._bindResourceResolvers(moduleInstance, actionMetadata, actionName, actionRoute);
        const policyHandlers = this._bindPolicies(moduleInstance, actionMetadata, actionName, actionRoute);
        const beforeHandlers = this._bindMiddlewares(moduleInstance, actionMetadata, actionName, actionRoute, EMiddlewareOrder.BEFORE);
        const afterHandlers = this._bindMiddlewares(moduleInstance, actionMetadata, actionName, actionRoute, EMiddlewareOrder.AFTER);
        const actionHandler = this._bindAction(actionMetadata, actionName, actionRoute, controllerInstance);

        const handlers: express.RequestHandler[] = [
            initialise,
            ...authHandlers,
            ...resolveHandlers,
            checkPermissions,
            ...policyHandlers,
            ...beforeHandlers,
            actionHandler,
            ...afterHandlers
        ];

        switch (actionMetadata.method) {
            case ERequestMethod.GET:
                this._expressRouter.get(actionRoute, ...handlers);
                break;

            case ERequestMethod.PUT:
                this._expressRouter.put(actionRoute, ...handlers);
                break;

            case ERequestMethod.POST:
                this._expressRouter.post(actionRoute, ...handlers);
                break;

            case ERequestMethod.DELETE:
                this._expressRouter.delete(actionRoute, ...handlers);
                break;

            default:
                throw new Error(`[ornate] Unhandled request method: ${actionMetadata.method}`);
        }

        const authentication = actionMetadata.auth.map((p: IActionAuthMetadata) => colors.red(p.name));
        const authenticationString = authentication.length > 0 ? util.format("[%s]", authentication.join(", ")) : "";

        const permissions = this._auth !== undefined
            ? this._auth.findRoutePermissions(actionMetadata.method, actionRoute).map((p: IPermission) => colors.green(p.name))
            : [];

        const permissionsString = permissions.length > 0 ? util.format("[%s]", permissions.join(", ")) : "";

        const policies = actionMetadata.policies.map((p: IActionPolicyMetadata) => colors.magenta(p.name));
        const policiesString = policies.length > 0 ? util.format("[%s]", policies.join(", ")) : "";

        this._logger.debug("[ornate] · Action: %s [%s %s] %s",
            colors.cyan(actionName),
            colors.italic(actionMetadata.method.toLowerCase()),
            colors.yellow(actionRoute),
            [authenticationString, permissionsString, policiesString].filter((str: string) => str !== "").join(" ")
        );
    }

    private _initialiseAction(
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string,
        req: IAppRequest,
        res: AppResponse,
        next: express.NextFunction
    ): void {
        try {
            req.args = this._handleArgs(
                req,
                res,
                actionName,
                actionMetadata.method,
                actionRoute,
                actionMetadata.args,
                true
            );

            req.auth = new Map<string, IAuthentication>();
            req.resolved = new Map<string, any>();

            next();

        } catch (err) {
            this._handleActionError(res, err, actionName, actionMetadata.method, actionRoute);
        }
    }

    private _checkPermissions(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string,
        req: IAppRequest,
        res: AppResponse,
        next: express.NextFunction
    ): void {
        if (this._auth === undefined) {
            return next();
        }

        const authentication = actionMetadata.auth
            .map((m: IActionAuthMetadata) => req.args[m.index] as IAuthentication)
            .filter((a: IAuthentication) => a !== undefined);

        const result = this._auth.checkRoutePermissions(
            authentication,
            actionMetadata.method,
            actionRoute
        );

        if (result) {
            return next();
        }

        const users = authentication.map((a: IAuthentication) => util.format("[%s] %s", a.user.id, a.user.name));
        const message = util.format("[ornate] Unauthorized user action: %s", users.join(", "));

        this._logger.error(
            "%s [%s %s] %s: %s",
            colors.cyan(actionName),
            colors.italic(actionMetadata.method),
            colors.yellow(actionRoute),
            colors.red("PermissionError"),
            message
        );

        res.status(httpStatus.FORBIDDEN).send(message).end();
    }

    private _bindAuthResolvers(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string
    ): express.RequestHandler[] {

        const authHandlers = actionMetadata.auth.map((authMetadata: IActionAuthMetadata) => {
            const middlewareMetadata = Registry.getMiddlewareMetadata(authMetadata.service, authMetadata.name);
            if (middlewareMetadata === undefined) {
                this._logger.warn("[ornate] Auth middleware metadata not found for: %s (%s)", authMetadata.service.name, authMetadata.name);
                return undefined;
            }

            const instance = this._getServiceInstance(moduleInstance, authMetadata.service);
            const handler = middlewareMetadata.handler.bind(instance);
            this._logger.trace("[ornate] · Auth: %s [%s]",
                colors.green(middlewareMetadata.service),
                colors.green(middlewareMetadata.name)
            );

            return this._handleAuth.bind(this, middlewareMetadata, actionMetadata, authMetadata, actionName, actionRoute, handler);
        });

        // Filter out undefined handlers.
        return authHandlers.filter((handler: any) => handler !== undefined);
    }

    private _bindResourceResolvers(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string
    ): express.RequestHandler[] {

        const resolveHandlers = actionMetadata.resolve.map((resourceMetadata: IActionResourceMetadata) => {
            const resolveMetadata = Registry.getMiddlewareMetadata(resourceMetadata.service, resourceMetadata.name);
            if (resolveMetadata === undefined) {
                this._logger.warn(
                    "[ornate] Middleware resolve metadata not found for: %s (%s)",
                    resourceMetadata.service.name,
                    resourceMetadata.name
                );
                return undefined;
            }

            const instance = this._getServiceInstance(moduleInstance, resourceMetadata.service);
            const handler = resolveMetadata.handler.bind(instance);
            this._logger.trace("[ornate] · Resolve: %s [%s]",
                colors.green(resolveMetadata.service),
                colors.green(resolveMetadata.name)
            );

            return this._handleResolve.bind(this, resolveMetadata, actionMetadata, resourceMetadata, actionName, actionRoute, handler);
        });

        // Filter out undefined handlers.
        return resolveHandlers.filter((handler: any) => handler !== undefined);
    }

    private _bindPolicies(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string
    ): express.RequestHandler[] {

        const policyHandlers = actionMetadata.policies.map((metadata: IActionPolicyMetadata) => {
            const middleware = Registry.getMiddlewareMetadata(metadata.service, metadata.name);
            if (middleware === undefined) {
                this._logger.warn("[ornate] Resolve metadata not found for: %s (%s)", metadata.service.name, metadata.name);
                return undefined;
            }

            const instance = this._getServiceInstance(moduleInstance, metadata.service);
            const handler = middleware.handler.bind(instance);
            this._logger.trace("[ornate] · Policy: %s [%s]",
                colors.green(middleware.service),
                colors.green(middleware.name)
            );

            return this._handlePolicy.bind(this, middleware, actionMetadata, metadata, actionName, actionRoute, handler);
        });

        // Filter out undefined handlers.
        return policyHandlers.filter((handler: any) => handler !== undefined);
    }

    private _bindMiddlewares(
        moduleInstance: IModuleInstance,
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string,
        order: EMiddlewareOrder
    ): express.RequestHandler[] {

        const middlewares = Registry.getActionMiddlewareMetadata(actionMetadata.target, actionMetadata.handler);
        const orderedMetadata = middlewares.filter((m: IActionMiddlewareMetadata) => m.order === order).reverse();

        const handlers = orderedMetadata.map((m: IActionMiddlewareMetadata) => {
            const middlewareMetadata = Registry.getMiddlewareMetadata(m.service, m.name);
            if (middlewareMetadata === undefined) {
                this._logger.warn("[ornate] Middleware metadata not found for: %s (%s)", m.service.name, m.name);
                return undefined;
            }

            const instance = this._getServiceInstance(moduleInstance, m.service);
            const handler = middlewareMetadata.handler.bind(instance);
            this._logger.debug("[ornate] · Middleware: %s [%s %s] %s",
                colors.green(middlewareMetadata.service),
                colors.italic(m.order),
                colors.green(middlewareMetadata.name),
                m.params.length > 0 ? `params: ${m.params.join(", ")}` : ""
            );

            return this._handleMiddleware.bind(this, middlewareMetadata, actionMetadata, actionName, actionRoute, m.params, handler);
        });

        // Filter out undefined handlers.
        return handlers.filter((handler: ActionHandler<any>) => handler !== undefined);
    }

    private _bindAction(
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string,
        instance: ControllerInstance
    ): express.RequestHandler {
        const handler = actionMetadata.handler.bind(instance);

        return this._handleAction.bind(this, actionMetadata, actionName, actionRoute, handler);
    }

    private async _handleAuth(
        middlewareMetadata: IMiddlewareMetadata,
        actionMetadata: IActionMetadata,
        authMetadata: IActionAuthMetadata,
        actionName: string,
        actionRoute: string,
        handler: MiddlewareHandler<IAuthentication>,
        req: IAppRequest,
        res: AppResponse,
        next: express.NextFunction
    ): Promise<void> {
        try {
            const args = this._handleArgs(
                req,
                res,
                middlewareMetadata.handler.name,
                actionMetadata.method,
                actionRoute,
                middlewareMetadata.args
            );

            this._handleResources(
                req,
                args,
                middlewareMetadata.auth,
                middlewareMetadata.resolve
            );

            const result = await handler(...args);

            // Update action args.
            req.args[authMetadata.index] = result;

            req.auth.set(authMetadata.name, result);
            next();

        } catch (err) {
            this._handleMiddlewareError(
                res,
                err,
                middlewareMetadata.service,
                middlewareMetadata.name,
                actionName,
                actionMetadata.method,
                actionRoute
            );
        }
    }

    private async _handleResolve(
        middlewareMetadata: IMiddlewareMetadata,
        actionMetadata: IActionMetadata,
        resourceMetadata: IActionResourceMetadata,
        actionName: string,
        actionRoute: string,
        handler: MiddlewareHandler<any>,
        req: IAppRequest,
        res: AppResponse,
        next: express.NextFunction
    ): Promise<void> {
        try {
            if (req.args.length <= resourceMetadata.index) {
                throw new Error(`[ornate] Invalid resource: [${resourceMetadata.index}] ${resourceMetadata.name}`);
            }

            const args = this._handleArgs(
                req,
                res,
                middlewareMetadata.handler.name,
                actionMetadata.method,
                actionRoute,
                middlewareMetadata.args
            );

            this._handleResources(
                req,
                args,
                middlewareMetadata.auth,
                middlewareMetadata.resolve
            );

            const result = await handler(...args, req.args[resourceMetadata.index]);
            if (result === undefined && resourceMetadata.required === true) {
                throw new ParameterError(`[ornate] Could not resolve resource: ${resourceMetadata.name}`);
            }

            // Update action args.
            req.args[resourceMetadata.index] = result;

            req.resolved.set(resourceMetadata.name, result);
            next();

        } catch (err) {
            this._handleMiddlewareError(
                res,
                err,
                middlewareMetadata.service,
                middlewareMetadata.name,
                actionName,
                actionMetadata.method,
                actionRoute
            );
        }
    }

    private async _handleMiddleware(
        middlewareMetadata: IMiddlewareMetadata,
        actionMetadata: IActionMetadata,
        actionName: string,
        actionRoute: string,
        params: any[],
        handler: MiddlewareHandler<boolean>,
        req: IAppRequest,
        res: AppResponse,
        next: express.NextFunction
    ): Promise<void> {
        try {

            const args = this._handleArgs(
                req,
                res,
                middlewareMetadata.handler.name,
                actionMetadata.method,
                actionRoute,
                middlewareMetadata.args
            );

            this._handleResources(
                req,
                args,
                middlewareMetadata.auth,
                middlewareMetadata.resolve
            );

            const result = await handler(...args, ...params);

            if (result) {
                // Continue with next middleware.
                next();

            } else {
                // End response.
                res.status(httpStatus.OK).end();
            }

        } catch (err) {
            this._handleMiddlewareError(
                res,
                err,
                middlewareMetadata.service,
                middlewareMetadata.name,
                actionName,
                actionMetadata.method,
                actionRoute
            );
        }
    }

    private async _handlePolicy(
        middlewareMetadata: IMiddlewareMetadata,
        actionMetadata: IActionMetadata,
        policyMetadata: IActionPolicyMetadata,
        actionName: string,
        actionRoute: string,
        handler: MiddlewareHandler<boolean>,
        req: IAppRequest,
        res: AppResponse,
        next: express.NextFunction
    ): Promise<void> {
        try {
            const args = this._handleArgs(
                req,
                res,
                middlewareMetadata.handler.name,
                actionMetadata.method,
                actionRoute,
                middlewareMetadata.args
            );

            this._handleResources(
                req,
                args,
                middlewareMetadata.auth,
                middlewareMetadata.resolve
            );

            const result = await handler(...args, req.args[policyMetadata.index]);
            if (result) {
                next();

            } else {
                throw new AuthorizationError("[ornate] Unauthorised resource access");
            }

        } catch (err) {
            this._handleMiddlewareError(
                res,
                err,
                middlewareMetadata.service,
                middlewareMetadata.name,
                actionName,
                actionMetadata.method,
                actionRoute
            );
        }
    }

    private async _handleAction(
        metadata: IActionMetadata,
        actionName: string,
        actionRoute: string,
        handler: ActionHandler<any>,
        req: IAppRequest,
        res: AppResponse,
        next: express.NextFunction
    ): Promise<void> {
        try {
            // Check auth.

            const result = await handler(...req.args) as ActionResponse<any>;

            if (result.status === httpStatus.MOVED_TEMPORARILY) {
                res.location(result.data);
            }

            // Send status.
            res.status(result.status);

            // Set headers.
            if (result !== undefined && result.headers !== undefined) {
                Object.keys(result.headers).map((key) => {
                    res.setHeader(key, result.headers[key]);
                });
            }

            if (result === undefined || result.data === undefined) {
                // Return now.
                return res.end();
            }

            // Send data.
            res.send(result.data);

            if (result.next) {
                // Continue with next middleware.
                next();

            } else {
                // End response.
                res.end();
            }

        } catch (err) {
            this._handleActionError(res, err, actionName, metadata.method, actionRoute);
        }
    }

    private _handleMiddlewareError(
        res: AppResponse,
        err: Error,
        service: string,
        name: string,
        action: string,
        method: ERequestMethod,
        route: string
    ): void {
        if (err instanceof AppError) {
            this._logger.error(
                "[ornate] [%s '%s'] %s [%s %s] %s: %s %s",
                colors.green(service),
                colors.green(name),
                colors.cyan(action),
                colors.italic(method),
                colors.yellow(route),
                colors.red(err.name),
                err.message,
                err.data !== undefined ? colors.italic(err.data) : ""
            );
            res.status(err.code).send(err.message).end();
        } else {
            this._logger.error(
                "[ornate] [%s '%s'] %s [%s %s] %s: %s",
                colors.green(service),
                colors.green(name),
                colors.cyan(action),
                colors.italic(method),
                colors.yellow(route),
                colors.red(err.name),
                err.message
            );
            res.status(httpStatus.INTERNAL_SERVER_ERROR).end();
        }
    }

    private _handleActionError(
        res: AppResponse,
        err: Error,
        name: string,
        method: ERequestMethod,
        route: string
    ): void {
        if (err instanceof AppError) {
            this._logger.error(
                "[ornate] %s [%s %s] %s: %s %s",
                colors.cyan(name),
                colors.italic(method),
                colors.yellow(route),
                colors.red(err.name),
                err.message,
                err.data !== undefined ? colors.italic(JSON.stringify(err.data)) : ""
            );

            const message = err.data !== undefined ?
                            util.format("%s (%s)", err.message, JSON.stringify(err.data)) :
                            err.message;

            res.status(err.code).send(message).end();

        } else {
            this._logger.error(
                "[ornate] %s [%s %s] %s: %s",
                colors.cyan(name),
                colors.italic(method),
                colors.yellow(route),
                colors.red(err.name),
                err.message
            );
            res.status(httpStatus.INTERNAL_SERVER_ERROR).end();
        }
    }

    private _handleArgs(
        req: IAppRequest,
        res: AppResponse,
        actionName: string,
        actionMethod: ERequestMethod,
        actionRoute: string,
        argsMetadata: IActionArgsMetadata[],
        report = false
    ): any[] {
        const args = new Array<any>();

        const requestKey = argsMetadata.find((am: IActionArgsMetadata) => am.type === EArgType.REQUEST);
        const responseKey = argsMetadata.find((am: IActionArgsMetadata) => am.type === EArgType.RESPONSE);
        const hostKey = argsMetadata.find((am: IActionArgsMetadata) => am.type === EArgType.HOST);
        const hostnameKey = argsMetadata.find((am: IActionArgsMetadata) => am.type === EArgType.HOSTNAME);
        const methodKey = argsMetadata.find((am: IActionArgsMetadata) => am.type === EArgType.METHOD);
        const routeKey = argsMetadata.find((am: IActionArgsMetadata) => am.type === EArgType.ROUTE);

        if (requestKey !== undefined) {
            args[requestKey.index] = req;
        }
        if (responseKey !== undefined) {
            args[responseKey.index] = res;
        }
        if (hostKey !== undefined) {
            args[hostKey.index] = `${req.protocol}://${req.get("host")}`;
        }
        if (hostnameKey !== undefined) {
            args[hostnameKey.index] = req.get("host");
        }
        if (methodKey !== undefined) {
            args[methodKey.index] = actionMethod;
        }
        if (routeKey !== undefined) {
            args[routeKey.index] = actionRoute;
        }

        this._handleRequestSource(req.headers, args, argsMetadata.filter((am: IActionArgsMetadata) => am.type === EArgType.HEADER), true);
        const bodyKeys = this._handleRequestSource(req.body, args, argsMetadata.filter((am: IActionArgsMetadata) => am.type === EArgType.BODY));
        const queryKeys = this._handleRequestSource(req.query, args, argsMetadata.filter((am: IActionArgsMetadata) => am.type === EArgType.QUERY));
        const paramKeys = this._handleRequestSource(req.params, args, argsMetadata.filter((am: IActionArgsMetadata) => am.type === EArgType.PARAM));

        if (report) {
            this._reportUnhandledKeys("body", actionName, req.body, bodyKeys);
            this._reportUnhandledKeys("query", actionName, req.query, queryKeys);
            this._reportUnhandledKeys("params", actionName, req.params, paramKeys);
        }

        return args;
    }

    private _handleResources(
        req: IAppRequest,
        args: any[],
        authMetadata: IActionAuthMetadata[],
        resolveMetadata: IActionResourceMetadata[]
    ): void {
        // Set auth resources.
        for (const resource of authMetadata) {
            const value = req.auth.get(resource.name);
            if (value === undefined) {
                throw new AuthenticationError(util.format("[ornate] Required auth parameter not found: %s", resource.name));
            }

            args[resource.index] = value;
        }

        // Set resolved resources.
        for (const resource of resolveMetadata) {
            const value = req.resolved.get(resource.name);
            if (value === undefined && resource.required) {
                throw new ParameterError(util.format("[ornate] Required resolved parameter not found: %s", resource.name));
            }

            args[resource.index] = value;
        }
    }

    private _handleRequestSource(
        source: {[key: string]: string | string[]},
        args: any[],
        argsMetadata: IActionArgsMetadata[],
        lowercase = false
    ): string[] {
        // Store the handled keys here.
        const keys = new Array<string>();

        // First, set the defined ones.
        for (const argMetadata of argsMetadata) {
            const key = lowercase ? argMetadata.name.toLowerCase() : argMetadata.name;
            if (argMetadata.required && (source === undefined || !source.hasOwnProperty(key))) {
                throw new ParameterError(util.format("[ornate] Required %s argument not found: %s", argMetadata.type, argMetadata.name));
            }

            args[argMetadata.index] = source[key];
            keys.push(argMetadata.name);
        }

        return keys;
    }

    private _reportUnhandledKeys(name: string, action: string, source: any, keys: string[]): void {
        if (source === undefined) {
            return;
        }

        for (const key of Object.keys(source)) {
            if (keys.indexOf(key) === -1) {
                this._logger.warn("[ornate] Action: %s detected unhandled %s key: %s", action, name, key);
            }
        }
    }

    private _getModuleInstance<T>(target: IType<T>): IModuleInstance {
        let instance = this.MODULES.get(target);
        if (instance === undefined) {
            instance = new target();
            this.MODULES.set(target, instance);
        }

        return instance;
    }

    private _getServiceInstance<T>(moduleInstance: IModuleInstance, target: IType<T>): IServiceInstance {
        let instance = this.SERVICES.get(target);
        if (instance === undefined) {
            instance = this._newInstance(moduleInstance, target);
            this.SERVICES.set(target, instance);
        }

        return instance;
    }

    private _getMigrationInstance<T>(moduleInstance: IModuleInstance, name: string, target: IType<T>): IMigrationInstance {
        let instance = this.MIGRATIONS.get(name);
        if (instance === undefined) {
            instance = this._newInstance(moduleInstance, target);
            this.MIGRATIONS.set(name, instance);
        }

        return instance;
    }

    private _newInstance<T>(moduleInstance: IModuleInstance, target: IType<T>): any {
        const params = Reflect.getOwnMetadata("design:paramtypes", target);
        const constructor = params === undefined || params.length === 0
                          ? target
                          : this._inject(moduleInstance, target, params);

        return new constructor();
    }

    private _inject<T>(moduleInstance: IModuleInstance, target: IType<T>, params: any[]): IType<T> {
        const injectables = this._resolveInjectables(target);

        // Iterate arguments and replace with injected services.
        const args = params.map((f: any, index: number) => {
            // First, determine whether this argument is provided.
            const provider = moduleInstance.providers.find((p) => p.provides === f);
            if (provider !== undefined) {
                return provider.service;
            }

            // Now check if it should be declaratively injected.
            if (injectables.length > 0) {
                const injectable = injectables.find((i) => {
                    return i.index === index;
                });

                if (injectable !== undefined) {
                    return injectable.service;
                }
            }

            return this._getServiceInstance(moduleInstance, f);
        });

        return target.bind(undefined, ...args);
    }

    private _resolveInjectables<T>(target: IType<T>): IInjectableInstance[] {
        // Get injectables for this service.
        const injectableMetadata = Registry.getInjectableMetadata(target);
        const injectables = new Array<IInjectableInstance>();
        if (injectableMetadata !== undefined) {
            for (const metadata of injectableMetadata) {
                switch (metadata.type) {
                    case EInjectableType.HTTP_SERVER:
                        injectables.push({index: metadata.index, service: this._httpServer});
                        break;
                }
            }
        }

        return injectables;
    }
}
