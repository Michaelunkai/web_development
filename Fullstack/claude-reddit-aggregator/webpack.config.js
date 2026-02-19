const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const projectRoot = path.resolve(__dirname);

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        context: projectRoot,
        entry: path.resolve(projectRoot, 'src', 'index.jsx'),
        output: {
            path: path.resolve(projectRoot, 'public'),
            filename: 'bundle.js',
            publicPath: '/',
            clean: false
        },
        resolve: {
            extensions: ['.js', '.jsx', '.json'],
            modules: [path.resolve(projectRoot, 'node_modules'), 'node_modules']
        },
        resolveLoader: {
            modules: [path.resolve(projectRoot, 'node_modules'), 'node_modules']
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: require.resolve('babel-loader'),
                        options: {
                            configFile: path.resolve(projectRoot, 'babel.config.js')
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: [
                        require.resolve('style-loader'),
                        require.resolve('css-loader'),
                        {
                            loader: require.resolve('postcss-loader'),
                            options: {
                                postcssOptions: {
                                    config: path.resolve(projectRoot, 'postcss.config.js')
                                }
                            }
                        }
                    ]
                }
            ]
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, 'public', 'index.html'),
                filename: 'index.html',
                inject: true
            })
        ],
        devServer: {
            static: {
                directory: path.resolve(__dirname, 'public')
            },
            port: 3001,
            hot: true,
            historyApiFallback: true,
            proxy: [
                {
                    context: ['/api', '/socket.io'],
                    target: 'http://localhost:3000',
                    ws: true
                }
            ]
        },
        devtool: isProduction ? 'source-map' : 'eval-source-map',
        mode: isProduction ? 'production' : 'development',
        performance: {
            hints: isProduction ? 'warning' : false
        }
    };
};
