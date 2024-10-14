# Streckenkarte

A tool to display maps of lines as vector tiles using leaflet.


## Dependencies

* Tippecanoe 
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

```
location ~ /.+/$ {
	rewrite ^/(.*)$ /common/index.html last; 
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
		"train": {"color": "blue", "width": 2, "humanname": "Train"}
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
