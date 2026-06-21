# Older changes
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
