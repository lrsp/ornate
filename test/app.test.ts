import * as ornate from "../src/ornate";
import * as chai from "chai";
import * as sinon from "sinon";
import chaiAsPromised from "chai-as-promised";

const expect = chai.expect;
chai.use(chaiAsPromised);

interface IUser {
    readonly name: string;
    readonly email: string;
    readonly phone: string;
}

@ornate.Service()
class TestService1 {

    public async onInit(): Promise<void> {
    }

    public work(): void {
    }

}

@ornate.Service()
class TestService2 {

    private _testService1: TestService1;

    constructor(testService1: TestService1) {
        this._testService1 = testService1;
    }

    public workWithInjectedService(): void {
        this._testService1.work();
    }

}

@ornate.Controller("hello")
class HelloController {

    @ornate.Get("")
    public hello(): ornate.TextResponse {
        return new ornate.TextResponse("Hello");
    }

    @ornate.Get(":name")
    public helloName(
        @ornate.Param("name") name: string
    ): ornate.TextResponse {
        return new ornate.TextResponse(`Hello ${name}`);
    }

    @ornate.Put("user")
    public create(
        @ornate.Query("name", true) name: string,
        @ornate.Query("email", true) email: string,
        @ornate.Query("phone") phone: string
    ): ornate.JsonResponse<IUser> {
        const user = {
            name,
            email,
            phone
        };

        return new ornate.JsonResponse<IUser>(user);
    }
}

@ornate.Module({
    services: [
        TestService1,
        TestService2
    ],
    initialize: [
        TestService1
    ]
})
class ServiceModule {}

@ornate.Module({
    route: "test",
    controllers: [
        HelloController
    ]
})
class ControllerModule {}

describe("Ornate App", () => {

    let app: ornate.App;

    before("Initialise app", () => {
        app = new ornate.App({
            modules: [ServiceModule, ControllerModule]
        });
    });

    after("Destroy app", () => {
        app.stop();
    });

    it("App services are initialized", async () => {
        const initSpy = sinon.stub(app.getService(TestService1), "onInit");

        await expect(app.run()).to.not.be.rejected;
        sinon.assert.calledOnce(initSpy);

        initSpy.restore();
    });

    it("Services are injected", async () => {
        const workSpy = sinon.stub(app.getService(TestService1), "work");

        app.getService(TestService2).workWithInjectedService();

        sinon.assert.calledOnce(workSpy);

        workSpy.restore();
    });

    it("Calls the /hello api route", async () => {
        const test = app.getRouter().get("/test/hello");

        const { headers, body } = await test.run();

        expect(headers["content-type"]).to.equal("text/html; charset=utf-8");
        expect(body).to.equal("Hello");
    });

    it("Calls the /hello/:name api route", async () => {
        const test = app.getRouter().get("/test/hello/ornate");

        const { headers, body } = await test.run();

        expect(headers["content-type"]).to.equal("text/html; charset=utf-8");
        expect(body).to.equal("Hello ornate");
    });

    it("Calls the /hello/create api route", async () => {
        const name = "Ornate";
        const email = "ornate@example.com";

        const test = app.getRouter().put(`/test/hello/user?name=${name}&email=${email}`);

        const { headers, body } = await test.run<IUser>();

        expect(headers["content-type"]).to.equal("application/json; charset=utf-8");
        expect(body.name).to.equals(name);
        expect(body.email).to.equals(email);
        expect(body.phone).to.equals(undefined);
    });

    it("Fails calling the /hello/create api route (missing parameters", async () => {
        const test = app.getRouter().put("/test/hello/user");

        await expect(test.run<IUser>()).to.be.rejected;
    });

});
