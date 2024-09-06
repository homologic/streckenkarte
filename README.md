# Streckenkarte

A tool to display maps of lines as vector tiles using leaflet.


## Dependencies

* Tippecanoe 
* ogrmerge (part of gdal-bin in Debian)

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
GeoJSON or gpx. 


