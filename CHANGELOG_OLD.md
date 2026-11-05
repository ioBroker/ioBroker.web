# Older changes
## 9.1.14 (2026-10-11)
* (@GermanBluefox) Fixed the lost body of `POST /state/...` with authentication enabled: the app's values arrived empty ("Empty body for ...")
* (@GermanBluefox) Fixed the crash `server.shouldUpgradeCallback is not a function` on WebSocket connections over HTTP/1.1 with HTTP/2 enabled

## 9.1.12 (2026-10-04)
* (@GermanBluefox) Fixed: with the cache enabled, a file that an adapter writes again under the same name is delivered anew instead of forever in the version that was read first. This is what made `sayit` repeat the same announcement. The cache had no way of learning about a change at all - the adapter never subscribed to the files it had cached. It does now, for those namespaces only, and drops the entry when the file changes
* (@GermanBluefox) Fixed: an adapter that runs as a web extension is linked to this server on the overview page instead of to a port of its own that nothing listens on. The entry such an adapter supplies through `welcomePage()` was collected after the list had already been cleaned up and its links resolved, so it never got the `localLink` the page reads and was dropped without a word, leaving only the dead link from `common.localLinks` behind
* (@GermanBluefox) The folder index got the look of the admin: an app bar with the path and the number of entries, icons telling a folder from a file, sizes in a readable unit, and a light and a dark theme the page selects itself from the setting of the system. A folder of 0 bytes says "0 B" instead of nothing, and the way up is no longer offered in the root of an adapter, where it led out of it
* (@GermanBluefox) An unexpected error while reading a session no longer ends the instance. The session store answers from a task of its own, so an exception in one of its callbacks reached neither express nor a `try/catch` and the controller terminated the whole web server over a single request. The four callbacks are guarded now and answer with a 500 instead. The same went for two promises in `onObjectChange`/`onStateChange` without a `catch`, where a rejected read of the socket URL arrived as an unhandled rejection
* (@GermanBluefox) Added the option "Allow embedding in other sites": the session cookie is sent with `SameSite=None; Secure`, so a page of this server keeps its session when another site embeds it in an iframe. It requires SSL here or an https reverse proxy with the public URL set, and it is off by default because it gives up the protection `SameSite` provides against requests of foreign pages
* (@GermanBluefox) Fixed: a call of `/prolongSession` no longer kills the instance. The session was handed to the store without its time to live, the store took the session object itself for it, and the type check of the controller ended the adapter with "Parameter ttl needs to be of type number". The session is also written back under the ID its cookie carries - `req.session.id` is a different one as soon as express-session started a new session for the request, and then the wrong session was prolonged
* (@GermanBluefox) Fixed: an address without the closing slash - `/vis-2` instead of `/vis-2/` - leads to the application instead of a 404. It is answered with a redirect to the address with the slash, as every other web server does
* (@GermanBluefox) A 404 names the address that was requested, not the file name left over after the adapter name was cut off, and logs it on the debug level
* (@hdering) A web instance that restarts to load a changed web extension logs this as info with the reason instead of the warning "Terminated (-100): Without reason"

## 9.1.11 (2026-10-02)
* (@hdering) Updating an adapter with a web extension restarts only the web instances that run it, not every web instance
* (@GermanBluefox) Fixed: a user the "User list" lets in through a group is let in no matter which of their groups it is. Only the first group the user was a member of got compared against the allowed ones, so a user in several groups was rejected whenever that first group was not the listed one. The order of the groups is their creation order, which made this look arbitrary

## 9.1.9 (2026-09-28)
* (@GermanBluefox) Added onScreen state for App

## 9.1.8 (2026-09-24)
* (@GermanBluefox) An empty body for `cloud.X.remote.command` is refused with a 400 instead of writing an empty command that is dropped without a word

## 9.1.7 (2026-09-21)
* (@joltcoke) Fixed: after the login the user lands on the page they asked for again, even when its URL carries a query string. The target was validated after it had been decoded, against a character list without "=", so every real query parameter sent the user to the root instead. A fragment of the requested URL is kept as well
* (@GermanBluefox) Fixed: a mistyped password leads back to the login page with the error message instead of a 404, and the requested page is not lost on the way
* (@GermanBluefox) Fixed: a deep link that was answered with a JavaScript file keeps its whole query string - it was cut off at the first "&"
* (@GermanBluefox) A target with a control character in it is refused again: browsers drop tab and newline before they read a URL, which turned "/<TAB>/host" into a link that leaves this server

## 9.1.5 (2026-09-20)
* (@GermanBluefox) Added: the instance settings show a QR code for the ioBroker.visu app. It carries the addresses and the port of this instance, and the ioBroker.pro credentials of a cloud or iot instance if there is one - without such an instance the app reaches this server in the local network only
* (@GermanBluefox) Added: with HTTPS enabled, the web server speaks HTTP/2 - the browser loads the page and all its files over a single connection. Clients without HTTP/2 fall back to HTTP/1.1 automatically; the new option "Use HTTP/2" in the instance settings turns it off
* (@GermanBluefox) `POST /state/<id>` creates the state it writes into for the six ids a visu app reports to: `vis.<X>.<device>.` plus `battery.level`, `battery.state`, `brightness`, `currentLocation`, `alive` or `instanceId`, together with the device they belong to. They are made from the definitions in the adapter, never from the request, and every other id is answered with a 404 as before.
* (@GermanBluefox) A command a visu app writes into `cloud.<X>.remote.command` is turned into `cloud.<X>.devices.<device>.*` here when the cloud adapter is not running. The app reported nothing at all while that adapter was stopped, although the value had arrived. Nothing changes while the adapter runs — it does this itself. The command state is created when it is missing, so an installation without the cloud adapter can be reported to as well.

## 9.1.4 (2026-08-31)
* (@GermanBluefox) Updated packages

## 9.1.3 (2026-08-28)
* (@GermanBluefox) Updated packages

## 9.1.2 (2026-08-27)
* (@GermanBluefox) Added the setting `acmeChallenge` (enabled by default): the web server answers the ACME HTTP-01 challenges published by the acme adapter, so the acme adapter no longer has to stop this instance to get at port 80

## 9.1.1 (2026-08-26)
* (@GermanBluefox) Fixed the CORS headers missing on every route that answers without passing the request on - the whole OAuth2 server among them. Retrieving a token from a browser on another origin failed with `No Access-Control-Allow-Origin header is present`. The CORS middleware is now registered in front of all routes instead of behind them
* (@GermanBluefox) A reflected origin is now sent together with `Vary: Origin`, and an unset origin, method or header list no longer ends up as the literal string `undefined` in the response

## 9.1.0 (2026-08-04)
* (@GermanBluefox) Added the OAuth2 authorization code flow with PKCE, so third-party clients (e.g. MCP clients) can be authorized without seeing the user's password
* (@GermanBluefox) Unauthenticated non-HTML requests now get a `401` challenge instead of a login redirect when OAuth is enabled
* (@GermanBluefox) Updated `@iobroker/webserver` to 2.0.1

## 9.0.0 (2026-06-21)
* (@GermanBluefox) Used libraries for socket communication instead of adapters
* (@GermanBluefox) Migrated to TS 6

## 8.3.0 (2026-06-12)
* (@SimonFischer04) Added rootPath option to support the running behind a reverse proxy

## 8.2.0 (2026-05-21)
* (@GermanBluefox) Added `/object/<ID>` GET endpoint with `type`, `commonType`, `depth`, `extended`, `native` and `system` query parameters to read objects (wildcards supported). By default, only `_id`, `type` and `common` are returned, type defaults to `state`, and objects under `system.*` / `script.*` are hidden. With `depth`, deeper matches yield synthetic `type: "virtual"` placeholders so a tree browser can see content exists below.
* (@GermanBluefox) Added `Disable objects delivery` setting to turn the `/object/<ID>` endpoint on/off

## 8.1.0 (2026-04-13)
* (@GermanBluefox) Updated packages.
* (@GermanBluefox) Corrected potential errors

## 8.0.0 (2026-02-18)
* (@GermanBluefox) Updated packages. The minimal Node.js version is now 20.0.0
* (@GermanBluefox) Removed binary states
* (@GermanBluefox) Added possibility to write values via `/state/` endpoint with `POST`

## 7.0.9 (2025-03-28)
* (@GermanBluefox) Corrected the loading of the material adapter

## 7.0.8 (2025-03-18)
* (@GermanBluefox) Added settings for custom CORS headers
* (@GermanBluefox) Added the possibility to show admin instances on the web welcome page
* (@GermanBluefox) Implemented the new index page

## 7.0.7 (2025-03-15)
* (@GermanBluefox) Trying to catch an error by the web extension

## 7.0.6 (2025-03-09)
* (@GermanBluefox) Corrected the login for iobroker.visu app
* (@GermanBluefox) Corrected load of TypeScript Web extensions

## 7.0.4 (2025-03-04)
* (@GermanBluefox) Corrected the login page
* (@GermanBluefox) Removed the frequent debug output

## 7.0.3 (2025-03-03)
* (@GermanBluefox) Corrected the problem with the user rights

## 7.0.1 (2025-03-02)
* (@GermanBluefox) [Breaking change] Removed simple-api as it could be connected as web-extension
* (@GermanBluefox) updated packages
* (@GermanBluefox) removed gulp in a build process
* (@GermanBluefox) Migrated GUI to vite
* (@GermanBluefox) Rewritten in TypeScript
* (@GermanBluefox) Added OAuth2 support
* (@GermanBluefox) Added new 404 and the directory list pages

## 6.3.1 (2024-09-23)
* (@foxriver76) added new admin icon (svg)

## 6.3.0 (2024-06-27)
* (bluefox) Corrected call of getObjectView with null parameter
* (bluefox) updated packages
* (bluefox) GUI was migrated to a non-style framework

## 6.2.6 (2024-05-25)
* (bluefox) Preparations for a custom loading background
* (bluefox) updated packages

## 6.2.5 (2024-02-22)
* (bluefox) Just some packages were updates

## 6.2.4 (2024-02-17)
* (klein0r) Extensions may block the web instance
* (klein0r) Fixed directory listing

## 6.2.3 (2023-12-18)
* (foxriver76) updated the websocket library to increase the maximum file size from 100 MB to 500 MB

## 6.2.2 (2023-12-14)
* (joltcoke) Corrected the crash if authentication is enabled

## 6.2.1 (2023-12-04)
* (bluefox) Added the user access list option

## 6.1.10 (2023-10-16)
* (bluefox) Corrected the start screen

## 6.1.7 (2023-10-16)
* (bluefox) Added the public accessibility check

## 6.1.6 (2023-10-13)
* (bluefox) Corrected adapter termination if the alias has no target
* (bluefox) Corrected socket.io connection

## 6.1.4 (2023-10-08)
* (foxriver76) upgrade socketio and ws dependencies to fix a vis subscribe problem

## 6.1.3 (2023-09-28)
* (bluefox) upgraded socketio and ws dependencies to correct the error by unsubscribing on client disconnect

## 6.1.2 (2023-09-14)
* (foxriver76) upgraded socketio and ws dependencies

## 6.1.1 (2023-09-05)
* (mcm1957) Added missing node16 requirement

## 6.1.0 (2023-08-01)
* (bluefox) Added the subscribing on the specific instance messages

## 6.0.3 (2023-07-27)
* (bluefox) Updated packages
* (bluefox) Implemented the possibility to view folder content

## 6.0.1 (2023-03-20)
* (bluefox) Removed letsencrypt handling from web adapter

## 5.5.3 (2023-03-17)
* (bluefox) Increased max size of the uploaded file via socket.io to 200MB (from 10MB)

## 5.5.2 (2023-03-03)
* (bluefox) Allowed deletion of fullcalendar objects

## 5.5.1 (2023-02-25)
* (bluefox) Allowed reading projects of vis-2-beta

## 5.5.0 (2023-02-15)
* (bluefox) Added special end-points for app authentication

## 5.4.3 (2023-01-29)
* (bluefox) Corrected error with `publishFileAll` (for future use)

## 5.4.1 (2022-12-23)
* (bluefox) Corrected GUI error

## 5.4.0 (2022-12-22)
* (bluefox) Used a new version of socket classes
