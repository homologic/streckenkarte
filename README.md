# Streckenkarte

A tool to display maps of lines as vector tiles using leaflet.


## Dependencies

* Tippecanoe (requires version 2 or later)
* ogrmerge (part of gdal-bin in Debian)
* jq

## Usage

This software is meant to be installed as a hosted installation for
several maps. This is done by putting the files in the `frontend`
directory on a web server so they appear as `/common/*`, and then
creating a directory for each map, with the maps appearing at
`/$mapname/`. This directory should contain a `strecken.pmtiles`
containing the vector tiles, as well as a `layers.json` containing
metadata, and the web server should be configured to display
`/common/index.html` when accessing `/$mapname/`. This can be achieved
on nginx with the following snippet:

```Nginx
location ~ /.+/$ {
	rewrite ^/(.*)$ /common/index.html last; 
}
```

On caddy, the same can be achieved with the following Caddyfile:

```Caddyfile
host {
	root * /var/www/html
	encode
	try_files {path} /common/index.html
	file_server
}
```

The `strecken.pmtiles` file is best generated using the
`mapbuilder.sh` script. Furthermore, exporting maps from umap is
possible using the `umap-extractor.py` script, which takes care of
exporting the data as well as the graphical style for each layer. 

A sample git `post-receive` hook is provided to build and deploy the
map when the map data is pushed.

### Input Data

The input data for `strecken.pmtiles` consists of a `data/` folder,
with one subfolder for each layer. In each of these folders, the lines
to be displayed on the map can be deposited in any format understood
by [ogrmerge](https://gdal.org/programs/ogrmerge.html), for instance,
GeoJSON or gpx. The input data can be obtained from OpenStreetMap
using tools such as [brouter][brouter] or [osmexp][osmexp].

#### layers.json

The metadata for the layers to be rendered is given by the
`layers.json` file in the input directory. An example layers.json file
is given below:

```json
{
	"name" : "My map", 
	"tilelayer" : {
		"attribution" : "Map data ©  <a href=\"http://osm.org/copyright\" >OpenStreetMap contributors</a>",
		"url_template" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
	},
   	"layers": {
		"tram": {"color": "red", "width": 1.5, "humanname": "Tram"},
		"train": {"color": "blue", "width": 2, "humanname": "Train"},
    "stations": {
      "url": "points.pmtiles",
      "layer": "stations",
      "type": "points",
      "color": "#0000FF",
      "radius": 3,
      "strokeColor": "#ffffff",
      "strokeWidth": 1.5,
      "humanname": "Stations"
      }
	},
	"maxZoom": 12
}
```

The `name` attribute sets the title of the map. The `tilelayer` sets
the background tile layer to be displayed (currently only raster tiles
are supported), with `attribution` stating where the tiles came from,
while `url_template` tells leaflet where to look for the tiles. 

The `layers` object includes an entry for each layer, indexed by the
name that each layer has in the `strecken.pmtiles` file (use the
[PMTiles Viewer](https://pmtiles.io/) for troubleshooting), with
`color` and `width` specifying how the layer should be rendered, and
`humanname` being the layer name that should be displayed in the legend.

The `maxZoom` parameter is given to `tippecanoe`, and determines the
maximum zoom level for which tiles should be rendered, increasing this
value also increases the size of the `strecken.pmtiles` file. If not
given explicitly `maxZoom` defaults to 10.


## Map Editing Mode

As a new experimental feature, Streckenkarte implements a simple
[brouter][brouter] frontend to allow for easy editing, currently only
supported on browsers that support
[showDirectoryPicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). It
can be accessed by adding `?edit=1` to the URL and then clicking the
"edit" button that appears in the top right corner. Then, the
directory containing the files for the layer that is to be edited can
be opened in the file selection dialog and lines can be drawn as in
the normal brouter web frontend. By clicking on "save", the lines are
saved locally in the chosen directory and will only appear on the
production map if processed correctly by the tile-generating script.

## Troubleshooting

### My pmtiles file is huge (hundreds of megabytes)

This may be caused due to metadata from the input geojson files being
carried over into the tiles, leading to that metadata getting copied
into every tile that has that feature, brouter is known to sometimes
add unreasonable amounts of metadata to its exports. The metadata can
be stripped by running

```
jq 'del( .features[] .properties )'
```

on the input file with excessive metadata. 


[brouter]: https://brouter.de/brouter-web/
[osmexp]: https://github.com/homologic/osmexp

## Hosting & Build Options
Besides the manual build process, there are also options for automated builds and deployments.

The following description is intended mainly as inspiration and starting point for your own setup.

### Git/CI-based workflow with S3 hosting
In this example, the streckenkarte is built in a CI-pipeline, while a webserver (e.g. S3-based like garage) is only tasked with delivering the static files.

1. Set up a git repository, and add this repository as a submodule in the folder `homologic-streckenkarte`.
2. Add your own map data in a folder `maps/{yourmapname}` (e.g. `maps/{yourmapname}/layers.json` and `maps/{yourmapname}/data/{layer}/42.gpx`).
3. Create a CI workflow to build and deploy the map (this example is for Forgejo Actions, but can be adapted to other CI systems):
```yaml
name: streckenkarte deploy

on:
  push:

jobs:
  build:
    runs-on: docker
    container:
      image: codeberg.org/margau/buildenv-streckenkarte:latest
    steps:
      - uses: https://code.forgejo.org/actions/checkout
        with:
          submodules: true
          fetch-depth: 0
      - name: set up output directory
        run: mkdir -p ./public/{yourmapname}
      - name: deploy frontend to public
        run: cp -r homologic-streckenkarte/frontend/* public/
      - run: bash homologic-streckenkarte/scripts/mapbuilder.sh "maps/{yourmapname}/" public/{yourmapname}/
      - run: cp maps/{yourmapname}/layers.json public/{yourmapname}/layers.json
      - uses: https://code.forgejo.org/forgejo/upload-artifact
        with:
          path: public/
          name: streckenkarte

  publish:
    runs-on: docker
    needs: build
    if: github.ref == format('refs/heads/{0}', 'main') || github.ref == 'main'
    container:
      image: codeberg.org/margau/buildenv-rclone:latest
    steps:
    - uses: https://code.forgejo.org/forgejo/download-artifact
      with:
        name: streckenkarte
        path: public
    - name: Upload S3
      run: rclone copy public/ mys3:streckenkarte
      env:
        RCLONE_CONFIG_*
```

This example builds the map in the first step and saves the public files as build artifact.
In the second stage, the public files are uploaded using RCLONE e.g. to an S3 bucket, from which it could be served as static website.
Adjust as needed to fit your setup.

The [codeberg.org/margau/buildenv-streckenkarte](https://codeberg.org/margau/-/packages/container/buildenv-streckenkarte/latest) container with every tool preinstalled is maintained [in a codeberg repo](https://codeberg.org/margau/buildenv/src/branch/main/streckenkarte)

The following nginx location blocks might be useful:
```
  location ~ /.+/$ {
    rewrite ^/(.*)$ /index.html last; 
  }
  location = / {
    return 307 https://railmap.example.com/{yourmapname}/;
  }
```