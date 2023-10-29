# ContainerUp

This repository is the backend of [ContainerUp](https://github.com/ContainerUp) project,
a [Podman](https://podman.io/) manager in your browser.
It works alongside the [frontend](https://github.com/ContainerUp/containerup/tree/main/web) project.

> [!NOTE]
> If you want to know how to use ContainerUp, visit [containerup.org](https://containerup.org/).
> 
> If you like this project, ⭐️ give a star, or 💰 sponsor the contributor!

## How to get started

### If you don't want to get involved in the frontend development

You can [build the frontend](https://github.com/ContainerUp/containerup/tree/main/web#i-only-need-the-artifacts).
It should look like this:

```shell
ls web/build
# asset-manifest.json  favicon.ico  index.html  robots.txt  static
```
Then you can start the development of the backend.

```shell
# A lot of tags required by podman
TAGS="remote exclude_graphdriver_btrfs btrfs_noversion exclude_graphdriver_devicemapper containers_image_openpgp"
go run -tags "$TAGS" containerup
```

Open your browser, and navigate to http://127.0.0.1:3876/.

### If you want to develop the frontend too

```shell
# A lot of tags required by podman
TAGS="remote exclude_graphdriver_btrfs btrfs_noversion exclude_graphdriver_devicemapper containers_image_openpgp"
go run -tags "$TAGS" containerup
```

The static web files aren't included, as the frontend repository will do a reverse proxy for you.

Then [run the frontend](https://github.com/ContainerUp/containerup-web#typical-way).
