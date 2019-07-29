# Ornate
A small decorator library to create express apps 

## Usage

```
import * as ornate from "ornate";

interface IUser {
    readonly name: string;
}

@ornate.Service()
class UserService {

    @ornate.Middleware("user")
    public async getUser(id: string): Promise<IUser> {
        // some async operation...

        return {
            name: "test-user"
        };
    }
}

@ornate.Service()
class AnotherService {

    constructor(userService: UserService) {
        // userService Will be injected
    }

}

@ornate.Service()
class DatabaseService() {

    public async onInit(): Promise<void> {
        // Perform some initialization. Can be async.
    }

}

@ornate.Controller("hello") // The controller route.
class HelloController {

    /**
     * Define a GET endpoint. You can use @Get, @Post, @Put, @Delete...
     *
     * As parameters you can use @Param, @Query, and more specialized ones (@Auth, @Resolve...)
     */
    @ornate.Get(":name")
    public hello(
        @ornate.Param("name") name: string,
        @ornate.Query("question") question: string
    ): Promise<ornate.TextResponse> {
        return new ornate.TextResponse(`Hello ${name}. You asked?: ${question}`);
    }

    /**
     * The resolve decorator will pass the supplied parameter (read with @Param, @Query, etc) to the middleware function.
     */
    @ornate.Get(":id")
    public getWithResolver(
        @ornate.Param("id") @ornate.Resolve(UserService, "user") user: IUser
    ): Promise<ornate.JsonResponse<IUser>> {
        return new ornate.JsonResponse(user);
    }

}

@ornate.Module({
    route: "api",
    services: [
        UserService,
        AnotherService,
        DatabaseService
    ],
    controllers: [
        HelloController
    ],
    initialize: [
        DatabaseService
    ]
})
class AppModule {}

const app = new ornate.App({
    modules: [
        AppModule
    ]
});

app.listen("0.0.0.0", 80).catch(() => process.exit(1));
```

### Authentication and Access control (ABAC/Policies)
Coming soon... (Check the code!)

Hint: Look for @ornate.Auth and @ornate.Policy

