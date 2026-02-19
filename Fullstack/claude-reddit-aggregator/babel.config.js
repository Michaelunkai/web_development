const path = require('path');

module.exports = {
    presets: [
        [require.resolve('@babel/preset-env'), {
            targets: {
                browsers: ['> 1%', 'last 2 versions', 'not dead']
            }
        }],
        [require.resolve('@babel/preset-react'), {
            runtime: 'automatic'
        }]
    ]
};
