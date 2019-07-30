const colors = require("ansi-colors");
const path = require("path");
const fs = require("fs");
const nodeExternals = require("webpack-node-externals");

const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

const CONFIG_FILE = path.resolve(__dirname, "tsconfig.json");
const SRC_PATH = path.resolve(__dirname, "src");
const BUILD_PATH = path.resolve(__dirname, "dist");

const WatchReportPlugin = function() {
    this.plugin("watch-run", (watching, done) => {
        const name = watching.options.name;
        const context = watching.context;
		const changed = Object.keys(watching.watchFileSystem.watcher.mtimes);

        if (changed.length > 0) {
			console.info(`${colors.green(name)} build triggered on ${colors.yellow(context)}`);
            for (const file of changed) {
                const filename = "." + file.substr(context.length);
                console.info(`  Updated file: ${colors.red(filename)}`);
            }
        }

        done();
      });
};

const environment = process.env.NODE_ENV;

let filename = "[name].js";
let optimization = undefined;

if (environment === "production") {
    filename = "[name].js";

    optimization = {
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    ecma: 8,
                    keep_classnames: true,
                    keep_fnames: true
                }
            })
        ]
    }
}

const ornateConfig = {
    mode   : environment,
    name   : "ornatejs",
    context: SRC_PATH,
    target : "node",
    externals: [nodeExternals()],
    entry  : {
        index: "./ornate.ts"
    },
    output : {
        path: BUILD_PATH,
        filename,
        libraryTarget: "commonjs2"
    },
    node: {
        __dirname: false
    },
    module: {
        rules: [
            {
                test: /\.node$/,
                loader: "node-loader"
            },
            {
                test: /\.ts$/,
                include: SRC_PATH,
                enforce: "pre",
                loader: "tslint-loader",
                options: {
                    typeCheck: true,
                    tsConfigFile: CONFIG_FILE,
                    configFile: "./tslint.json"
                }
            },
            {
                test: /\.ts$/,
                include: SRC_PATH,
                loaders: ["ts-loader"]
            }
        ]
    },
    resolve: {
        extensions: [".js", ".ts", ".json"],
        plugins: [new TsconfigPathsPlugin({ configFile: CONFIG_FILE })]
	},
	plugins: [
        WatchReportPlugin
    ],
    optimization,
    watchOptions: {
        ignored: /node_modules/,
        aggregateTimeout: 1000,
        poll: 2000
    }
};

module.exports = ornateConfig;
