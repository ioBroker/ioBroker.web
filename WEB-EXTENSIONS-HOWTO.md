# Web extensions
If some adapter want to be available under same port as web adapter, it should implement the web extension functionality.

First, it must have a `common.webExtension` flag in `io-package.json` file that points to thw web extension file. Like `"webExtension": "lib/web.js"`.

Second, the file `lib/web.js` (or whatever) must exist, and it must export a class.
```
/**
 * Web extension example
 *
 * @class
 * @param {object} server http or https node.js object
 * @param {object} webSettings settings of the web server, like <pre><code>{secure: settings.secure, port: settings.port}</code></pre>
 * @param {object} adapter web adapter object
 * @param {object} instanceSettings instance object with common and native
 * @param {object} app express application
 * @return {object} class instance
 */
function ExtensionExample(server, webSettings, adapter, instanceSettings, app) {
    this.app         = app;
    this.config      = instanceSettings ? instanceSettings.native : {};
    const that       = this;

    // instanceSettings and this.config contain instance config (not web adapter, but this one with web-extension)
    this.config.demoParam = this.config.demoParam || 'demo';

    this.unload = function () {
        return new Promise(resolve => {
            adapter.log.debug('Demo extension unloaded!');
            
            // unload app path
            const middlewareIndex = app._router.stack.findIndex(layer => 
                layer && layer.route === '/' + that.config.demoParam);
                
            if (middlewareIndex !== -1) {
                // Remove the matched middleware
                app._router.stack.splice(middlewareIndex, 1);
            }
            
            resolve();
        });
    };

    // self invoke constructor
    (function __constructor () {
        adapter.log.info('Install extension on /' + that.config.demoParam);
        
        that.app.use('/' + that.config.demoParam, (req, res) => {
            res.setHeader('Content-type', 'text/html');
            res.status(200).send('You called a demo web extension with path "' + req.url + '");
        });
    })();
}

module.exports = ExtensionExample;
```

## Examples
Following adapters support web-extensions:
- Cameras: https://github.com/ioBroker/ioBroker.cameras/blob/master/lib/web.js
- Simple-api: https://github.com/ioBroker/ioBroker.simple-api/blob/master/lib/simpleapi.js#L73
- Proxy: https://github.com/ioBroker/ioBroker.proxy/blob/master/lib/proxy.js#L20