# ContainerUp Web

This repository is the frontend page of the [ContainerUp](https://github.com/ContainerUp) project,
a [Podman](https://podman.io/) manager in your browser.
It works alongside the [API backend](https://github.com/ContainerUp/containerup) project.

> [!NOTE]
> If you want to know how to use ContainerUp, visit [containerup.org](https://containerup.org/).
>
> If you like this project, ⭐️ give a star, or 💰 sponsor the contributor!
>
>  Report **issues** [here](https://github.com/ContainerUp/containerup/issues).

## How to get started

### I only need the artifacts

Maybe you want to develop the backend, and don't get involved in the frontend development.
Use a Podman container to build everything!

```shell
# clone this repository first
git clone --depth=1 https://github.com/ContainerUp/containerup-web.git

# go to the workspace
cd containerup-web

# build
BUILD=$(date -u +%Y%m%d%H%M%S)
SHA=$(git rev-parse HEAD)
COMMIT=${SHA::7}
podman run --rm -v .:/app -w /app -e "REACT_APP_CONTAINERUP_BUILD=$BUILD" -e "REACT_APP_CONTAINERUP_COMMIT=$COMMIT" docker.io/library/node:18 sh -c "npm install && npm run build"

# your artifacts here, copy them to the working directory of the backend
ls build
# asset-manifest.json  favicon.ico  index.html  robots.txt  static
```

### Typical way

#### Create a reverse proxy configuration

To work with the backend, create a file `src/setupProxy.js` with the following content.
Replace the `target` value with the url of your own server.

```javascript
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
    app.use(
        createProxyMiddleware('/api', {
            target: 'http://127.0.0.1:3876',
            ws: true
        })
    );
};
```

#### Run the project

Setup some optional [environment variables](#environment-variables) if you need. Then some final commands.

```shell
# Install dependencies
npm install

# Run the app in the development mode
npm run start
```

## Environment variables

There are some configurations that can be specified by environment variables.

```shell
# version information showed in the app
REACT_APP_CONTAINERUP_VERSION=dev
REACT_APP_CONTAINERUP_BUILD=development_build
REACT_APP_CONTAINERUP_COMMIT=0000000

# Set this value to 1 and it's the demo as on https://demo.containerup.org/
REACT_APP_CONTAINERUP_DEMO=
# Google analytics 4, only used in the demo
REACT_APP_CONTAINERUP_GA4=
```

The values of environment variables are determined when the project is built, specifically, when you run `npm run start`
or `npm run build`. You can specify them like this:

```shell
REACT_APP_CONTAINERUP_XXXXX=xxxxx REACT_APP_CONTAINERUP_YYYYY=yyyyy npm run build
```
